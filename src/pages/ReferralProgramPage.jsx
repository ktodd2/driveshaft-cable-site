import React from 'react'
import SEOHead from '../components/common/SEOHead'

const defaultTiers = [
  { orders: 'First order', rate: '10%' },
  { orders: 'Second order', rate: '5%' },
  { orders: 'Orders 3–10', rate: '2%' },
  { orders: 'Orders 11–20', rate: '1%' },
]
const signupEmail = 'mailto:kurtis@k-todd.com?subject=Driveshaft%20Cable%20referral%20program'

export default function ReferralProgramPage() {
  return (
    <div className="pt-24 md:pt-32 bg-ktodd-dark">
      <SEOHead title="Referral Program" canonical="/referrals" description="Past Driveshaft Cable customers can request a referral code, share a first-order discount and earn rewards toward products or a check. See the default reward schedule." />
      <article className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20 text-gray-300">
        <header className="border border-yellow-500/40 rounded-2xl overflow-hidden bg-[#111111]">
          <div aria-hidden="true" className="h-2 caution-stripe" />
          <div className="p-6 sm:p-10 lg:p-12">
            <p className="text-yellow-400 font-industrial tracking-[0.16em] text-sm mb-4">DRIVESHAFT CABLE · REFERRAL PROGRAM</p>
            <h1 className="font-industrial text-4xl sm:text-5xl lg:text-6xl text-white leading-tight max-w-3xl">EARN CASH OR <span className="text-yellow-400">STORE CREDIT.</span></h1>
            <p className="text-lg sm:text-xl max-w-2xl mt-6 leading-relaxed">Already a Driveshaft Cable customer? Put your recommendation to work. Share your code with a first-time customer and earn rewards when they buy.</p>
            <div className="mt-7 flex flex-wrap gap-3 items-center">
              <a href={signupEmail} className="btn-primary min-h-[44px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-yellow-400">Request a referral code</a>
              <p className="text-sm text-gray-300">You must be a past customer to qualify.</p>
            </div>
          </div>
        </header>

        <section aria-labelledby="referral-how" className="mt-14">
          <h2 id="referral-how" className="font-industrial text-3xl text-white">HOW IT WORKS</h2>
          <ol className="grid md:grid-cols-3 gap-5 mt-6">
            {[
              ['Get your code', 'Email Kurtis or send a DM to request signup. We’ll confirm your past purchase and email you a private invitation to finish setting up your code.'],
              ['Share with a new customer', 'They enter your code at checkout on their first-ever paid website retail order and verify their email. The default first-order product discount is 5%.'],
              ['Earn and choose your reward', 'Their eligible paid orders earn reward balance for you. Reply to your monthly statement to request products or a check, subject to approval.'],
            ].map(([title, copy], index) => (
              <li key={title} className="border border-gray-700 rounded-xl bg-[#111111] p-6">
                <span aria-hidden="true" className="font-industrial text-yellow-400 text-3xl">0{index + 1}</span>
                <h3 className="text-xl font-industrial text-white mt-3">{title}</h3>
                <p className="mt-3 leading-relaxed">{copy}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="referral-rates" className="mt-14">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div><p className="text-sm text-yellow-400 font-semibold mb-2">DEFAULT EARNED REWARDS</p><h2 id="referral-rates" className="font-industrial text-3xl text-white">EVERY REFERRED CUSTOMER STARTS AT ORDER ONE.</h2></div>
            <span className="inline-flex rounded-full border border-yellow-500/50 px-4 py-2 text-yellow-300 text-sm">They get 5% off their first eligible order</span>
          </div>
          <dl className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
            {defaultTiers.map(tier => <div key={tier.orders} className="bg-[#151515] border border-gray-700 rounded-xl p-5 sm:p-7"><dt className="text-gray-200 font-semibold">{tier.orders}</dt><dd className="font-industrial text-5xl sm:text-6xl text-yellow-400 mt-3">{tier.rate}</dd></div>)}
          </dl>
          <p className="mt-5 leading-relaxed">The order count restarts separately for each customer you refer. Under this default schedule, commissions end after that customer’s 20th paid order. Discounts, rates and order limits may vary by code; review the settings provided with your invitation.</p>
          <p className="mt-3 text-sm leading-relaxed">These percentages earn reward balance, not an immediate cash payment. Rewards are calculated on product sales after discounts, excluding tax and shipping.</p>
        </section>

        <section aria-labelledby="referral-choices" className="mt-14 border border-yellow-500/40 rounded-2xl bg-[#171207] p-6 sm:p-9">
          <p className="text-sm text-yellow-300 font-semibold mb-2">YOUR REWARDS. YOUR CHOICE.</p>
          <h2 id="referral-choices" className="font-industrial text-3xl text-white">WHAT DOES $100 IN REWARDS GET YOU?</h2>
          <div className="grid sm:grid-cols-2 gap-6 mt-7">
            <div className="border-l-4 border-yellow-400 pl-5"><h3 className="font-industrial text-xl text-gray-100">STORE CREDIT</h3><p className="font-industrial text-5xl text-yellow-400 mt-2">$100</p><p className="mt-3 leading-relaxed">Use the full reward value toward retail-priced products. Product credit can cover shipping; shipping comes out of the same reward balance.</p></div>
            <div className="border-l-4 border-gray-500 pl-5"><h3 className="font-industrial text-xl text-gray-100">CASH BY CHECK</h3><p className="font-industrial text-5xl text-white mt-2">$50</p><p className="mt-3 leading-relaxed">Checks pay 50 cents per dollar in rewards. A $50 check uses $100 of your reward balance.</p></div>
          </div>
          <p className="mt-7 text-sm text-gray-200 leading-relaxed">Every redemption requires owner approval and enough available rewards. Product shipping and any applicable tax must fit within that balance.</p>
        </section>

        <section aria-labelledby="referral-details" className="mt-14">
          <h2 id="referral-details" className="font-industrial text-3xl text-white">A FEW DETAILS BEFORE YOU SHARE</h2>
          <ul className="mt-5 list-disc pl-6 space-y-3 leading-relaxed">
            <li>Codes are for first-time website retail buyers. Enter the code on the first paid order; no self-referrals or retroactive referrals.</li>
            <li>The buyer’s email links their future eligible orders to your code. They should keep using the same email address.</li>
            <li>Rewards become eligible seven days after payment. Refunds reduce rewards, including future earnings after a redemption. Fully refunded orders still count toward the order sequence.</li>
            <li>Monthly statements show your referred customers’ names, eligible product spending and earned commissions. Reply to choose a check or products; every payout needs approval.</li>
            <li>Code settings can change for future orders. Saved checkout terms and rewards already earned stay unchanged.</li>
          </ul>
        </section>

        <section aria-labelledby="referral-signup" className="mt-14 border-t border-gray-700 pt-10">
          <h2 id="referral-signup" className="font-industrial text-3xl text-white">ALREADY A CUSTOMER? LET’S GET YOU A CODE.</h2>
          <p className="mt-4 leading-relaxed">For more information or signup, email <a href={signupEmail} className="inline-flex min-h-[44px] items-center text-yellow-300 underline underline-offset-4 break-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-yellow-400">kurtis@k-todd.com</a> or send Kurtis a DM on social media.</p>
          <p className="mt-3 text-sm">Signup is by invitation after we confirm your past purchase. There is no public enrollment form.</p>
        </section>
      </article>
    </div>
  )
}
