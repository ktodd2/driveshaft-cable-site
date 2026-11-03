import {computeShipping,getPriceForQuantityFromDb,makeDbCache} from './pricing.ts'
import {checkDiscountCode,REPEAT_CUSTOMER_DISCOUNT} from './discounts.ts'
import {createTaxCalculation,isAddressTaxable} from './tax.ts'
export async function priceCheckout(db:any,stripe:any,input:any,{failTaxOpen=false}={}){
 const cache=makeDbCache(),lines=[]
 for(const item of input.items){
  const {data:product,error}=await db.from('products').select('id,name,base_price_cents,tiers,is_active,is_storefront,min_order_quantity,order_quantity_step').eq('id',item.productId).single()
  const inventory=await db.from('product_inventory').select('stock_quantity').eq('product_id',item.productId).single()
  if(error||!product?.is_active||!product.is_storefront||inventory.error||!inventory.data)throw Error('A selected product is unavailable')
  const stock=inventory.data.stock_quantity,min=Math.min(product.min_order_quantity||1,stock),step=product.order_quantity_step||1
  if(item.quantity>stock||item.quantity<min||(item.quantity!==stock&&(item.quantity-min)%step!==0))throw Error('Please review product quantities and available stock')
  cache.products.set(item.productId,{base_price_cents:product.base_price_cents,tiers:product.tiers||[]})
  lines.push({productId:item.productId,quantity:item.quantity,name:product.name,unitPrice:await getPriceForQuantityFromDb(item.productId,item.quantity,db,cache)})
 }
 const subtotalCents=lines.reduce((sum,line)=>sum+line.quantity*line.unitPrice,0),shippingCents=computeShipping(subtotalCents)
 let repeat=false
 if(input.customer.email){const {data,error}=await db.rpc('checkout_repeat_customer',{p_email:input.customer.email});if(error)throw Error('Could not verify pricing. Please try again.');repeat=data===true}
 const loyalty=repeat?Math.round(subtotalCents*REPEAT_CUSTOMER_DISCOUNT):0
 let code=0,discountCode=null
 if(input.discountCode){const check=await checkDiscountCode(input.discountCode,input.customer.email,db);if(!check.valid&&check.lookupFailed)throw Error('Could not verify pricing. Please try again.');if(check.valid){discountCode=check.code;code=Math.round(subtotalCents*check.percentOff/100)}}
 const discountCents=Math.max(loyalty,code),discountSource=discountCents===0?null:loyalty>=code?'loyalty':'code'
 const c=input.customer,address={line1:c.address1,line2:c.address2,city:c.city,state:c.state,postal_code:c.zip,country:c.country}
 let taxCents=0,taxCalculationId=null
 if(isAddressTaxable(address)){
  try{const tax=await createTaxCalculation(stripe,lines,subtotalCents,shippingCents,discountCents,address);taxCents=tax.taxCents;taxCalculationId=tax.calculationId}
  catch{if(!failTaxOpen)throw Error('Could not calculate tax. Please try again.')}
 }
 const totalCents=subtotalCents-discountCents+shippingCents+taxCents
 if(![subtotalCents,discountCents,shippingCents,taxCents,totalCents].every(Number.isSafeInteger)||totalCents<1||totalCents>99999999)throw Error('Invalid order total')
 return {lines,subtotalCents,discountCents,shippingCents,taxCents,taxCalculationId,totalCents,discountSource,discountCode,repeat}
}
