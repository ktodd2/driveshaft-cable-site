// Largest-remainder allocation keeps tax line totals exactly equal to merchandise
// after every stacked discount, including fractional percentages and one-cent ties.
export function discountedLineAmounts(lines,subtotal,discount){
 if(!Number.isSafeInteger(subtotal)||subtotal<0||!Number.isSafeInteger(discount)||discount<0||discount>subtotal)throw Error('Invalid discounted merchandise total')
 const gross=lines.map(line=>line.unitPrice*line.quantity)
 if(!gross.every(n=>Number.isSafeInteger(n)&&n>=0)||gross.reduce((sum,n)=>sum+n,0)!==subtotal)throw Error('Invalid merchandise lines')
 if(subtotal===0)return gross.map(()=>0)
 const target=BigInt(subtotal-discount),divisor=BigInt(subtotal)
 const parts=gross.map((amount,index)=>{const scaled=BigInt(amount)*target;return {index,amount:Number(scaled/divisor),remainder:scaled%divisor}})
 const remainder=Number(target)-parts.reduce((sum,p)=>sum+p.amount,0)
 const ranked=[...parts].sort((a,b)=>a.remainder===b.remainder?a.index-b.index:a.remainder>b.remainder?-1:1)
 for(let i=0;i<remainder;i++)ranked[i].amount++
 return parts.map(p=>p.amount)
}
