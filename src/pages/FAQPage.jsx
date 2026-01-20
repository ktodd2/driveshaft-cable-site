import React, { useState } from 'react'
import { Link } from 'react-router-dom'

const faqs = [
  {
    category: 'Product',
    items: [
      {
        question: 'What is the K.Todd Driveshaft Cable?',
        answer: 'The K.Todd Driveshaft Cable is a purpose-built safety device designed to securely suspend disconnected driveshafts during towing and recovery operations. It features 5/32" galvanized steel cable with heavy-duty aluminum couplers, providing a professional solution for keeping drivelines safely secured during transport.'
      },
      {
        question: 'What vehicles is this designed for?',
        answer: 'The Driveshaft Cable is designed for heavy-duty applications including Class 7-8 trucks, semi-tractors, vocational trucks, transit buses, construction equipment, agricultural equipment, and other large vehicles where driveshaft security during towing is critical.'
      },
      {
        question: 'What are the specifications?',
        answer: 'Cable Diameter: 5/32" steel wire cable. Total Length: 1000mm (39"). Working Load Limit: 2400 lb. End Construction: Crimped loops with aluminum couplers. The cable is galvanized for corrosion resistance.'
      },
      {
        question: 'Is it reusable?',
        answer: 'Yes, the K.Todd Driveshaft Cable is designed for repeated use. Simply inspect the cable and couplers before each use for any signs of wear or damage. With proper care, it will serve you reliably job after job.'
      }
    ]
  },
  {
    category: 'Usage',
    items: [
      {
        question: 'How do I install the Driveshaft Cable?',
        answer: 'Installation is simple: 1) Disconnect or remove the driveshaft from the vehicle being towed. 2) Thread the cable through the driveshaft yoke or around the shaft itself. 3) Attach the cable ends to the frame or crossmember using the aluminum couplers. The entire process takes just seconds.'
      },
      {
        question: 'Can I use this with any tow setup?',
        answer: 'The Driveshaft Cable works with wheel-lift, flatbed, and rotator operations. It\'s designed to be versatile enough for various towing configurations while maintaining security for the disconnected driveline.'
      },
      {
        question: 'What if the cable doesn\'t fit my application?',
        answer: 'The 39" length is designed to accommodate most heavy-duty applications. If you have specific requirements, contact us to discuss your needs. We may be able to provide a custom solution for fleet or specialty applications.'
      }
    ]
  },
  {
    category: 'Ordering',
    items: [
      {
        question: 'How do I place an order?',
        answer: 'You can order directly through our website for quantities of 1-9 units. For bulk orders of 10 or more units, we recommend requesting a quote to get volume pricing.'
      },
      {
        question: 'Do you offer volume discounts?',
        answer: 'Yes! We offer volume pricing for orders of 10+ units. Request a quote through our website or contact us directly to discuss fleet and wholesale pricing.'
      },
      {
        question: 'Where do you ship?',
        answer: 'We ship throughout the United States from our Houston, Texas location. Contact us for international shipping inquiries.'
      },
      {
        question: 'What payment methods do you accept?',
        answer: 'We accept all major credit cards through our secure checkout. For large orders, we can also arrange alternative payment methods—contact us to discuss options.'
      }
    ]
  },
  {
    category: 'Support',
    items: [
      {
        question: 'What if my product arrives damaged?',
        answer: 'We carefully inspect and package every unit before shipping. If your product arrives damaged, contact us immediately with photos and we\'ll make it right with a replacement.'
      },
      {
        question: 'How can I track my order?',
        answer: 'Once your order ships, you\'ll receive a confirmation email with tracking information. You can also check your order status on our Order Tracking page using your email and order number.'
      },
      {
        question: 'How do I contact customer support?',
        answer: 'Email us at houstontruckwreck@gmail.com. We typically respond within 24 hours during business days.'
      }
    ]
  }
]

function FAQItem({ question, answer }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="border-b border-gray-700 last:border-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full py-4 flex items-center justify-between text-left"
      >
        <span className="text-white font-medium pr-4">{question}</span>
        <svg
          className={`w-5 h-5 text-yellow-500 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="pb-4 text-gray-400">
          {answer}
        </div>
      )}
    </div>
  )
}

function FAQPage() {
  return (
    <div className="pt-20">
      {/* Hero Section */}
      <section className="py-20 bg-gradient-to-b from-ktodd-dark to-ktodd-charcoal">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-industrial text-white mb-4">
              FREQUENTLY ASKED <span className="text-yellow-500">QUESTIONS</span>
            </h1>
            <div className="w-24 h-1 bg-yellow-500 mx-auto mb-6"></div>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Everything you need to know about the K.Todd Driveshaft Cable.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ Content */}
      <section className="py-20 bg-ktodd-charcoal">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {faqs.map((category, categoryIndex) => (
            <div key={categoryIndex} className="mb-12 last:mb-0">
              <h2 className="text-2xl font-industrial text-yellow-500 mb-6">{category.category.toUpperCase()}</h2>
              <div className="bg-gray-800/50 border border-gray-700 divide-y divide-gray-700">
                {category.items.map((item, itemIndex) => (
                  <FAQItem key={itemIndex} question={item.question} answer={item.answer} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Still Have Questions */}
      <section className="py-16 bg-ktodd-dark">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-industrial text-white mb-4">
            STILL HAVE <span className="text-yellow-500">QUESTIONS?</span>
          </h2>
          <p className="text-gray-400 mb-8">
            Can't find the answer you're looking for? We're here to help.
          </p>
          <Link to="/contact" className="btn-primary">
            Contact Us
          </Link>
        </div>
      </section>
    </div>
  )
}

export default FAQPage
