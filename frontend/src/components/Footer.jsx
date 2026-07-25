import React from 'react';
import { Cpu, Mail, Phone, MapPin } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-slate-950 text-slate-400 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Brand */}
        <div className="flex flex-col space-y-4">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-violet-600 rounded-lg">
              <Cpu className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold text-white tracking-tight">PropValue AI</span>
          </div>
          <p className="text-sm">
            AI-driven property valuation & real estate investment intelligence platform. Providing pricing models, future growth predictions, and RAG chats.
          </p>
        </div>

        {/* Links */}
        <div>
          <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Features</h3>
          <ul className="space-y-2 text-sm">
            <li><a href="/properties" className="hover:text-violet-400 transition">Property Search</a></li>
            <li><a href="/valuation" className="hover:text-violet-400 transition">AI Valuation</a></li>
            <li><a href="/compare" className="hover:text-violet-400 transition">Comparison engine</a></li>
            <li><a href="/ai-assistant" className="hover:text-violet-400 transition">RAG Chat Assistant</a></li>
          </ul>
        </div>

        {/* Support */}
        <div>
          <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Database & Assets</h3>
          <ul className="space-y-2 text-sm">
            <li><a href="/dashboard" className="hover:text-violet-400 transition">Market Trends</a></li>
            <li><span className="text-slate-500">FastAPI & SQLite Seeding</span></li>
            <li><span className="text-slate-500">XGBoost & Prophet Forecasts</span></li>
          </ul>
        </div>

        {/* Contact */}
        <div className="space-y-3 text-sm">
          <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Contact</h3>
          <p className="flex items-center space-x-2">
            <Mail className="h-4 w-4 text-violet-400" />
            <span>intelligence@propvalueai.com</span>
          </p>
          <p className="flex items-center space-x-2">
            <Phone className="h-4 w-4 text-violet-400" />
            <span>+91 98765 43210</span>
          </p>
          <p className="flex items-center space-x-2">
            <MapPin className="h-4 w-4 text-violet-400" />
            <span>Bengaluru & Hyderabad, India</span>
          </p>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 pt-8 border-t border-white/5 text-center text-xs">
        <p>© {new Date().getFullYear()} PropValue AI Platform. Developed with FastAPI, XGBoost, React and Tailwind CSS.</p>
      </div>
    </footer>
  );
}
