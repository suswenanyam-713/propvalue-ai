import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, Brain, BarChart3, ArrowRight, ShieldCheck, Landmark } from 'lucide-react';

export default function LandingPage() {
  const navigate = useNavigate();
  const [searchCity, setSearchCity] = useState('');
  const [searchLoc, setSearchLoc] = useState('');

  const handleQuickSearch = (e) => {
    e.preventDefault();
    navigate(`/properties?city=${searchCity}&locality=${searchLoc}`);
  };

  const features = [
    {
      title: "AI Valuation engine",
      desc: "Instant property price estimation powered by XGBoost, trained on over 10,000 active real estate listings.",
      icon: Brain,
      link: "/valuation",
      color: "from-purple-500 to-indigo-600 shadow-purple-500/25"
    },
    {
      title: "Prophet price forecasting",
      desc: "Analyze price appreciation trends and look up projected valuations for 1, 3, and 5 years in the future.",
      icon: BarChart3,
      link: "/dashboard",
      color: "from-blue-500 to-cyan-600 shadow-blue-500/25"
    },
    {
      title: "Investment intelligence",
      desc: "Evaluate property deals utilizing data-driven investment scores, risk quotients, and estimated rental yields.",
      icon: Landmark,
      link: "/properties",
      color: "from-emerald-500 to-teal-600 shadow-emerald-500/25"
    }
  ];

  return (
    <div className="relative overflow-hidden min-h-screen text-slate-100 bg-[#0b0f19]">
      
      {/* Decorative ambient background glows */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-violet-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-cyan-500/10 blur-[130px] pointer-events-none" />

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24 relative z-10">
        <div className="text-center max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-flex items-center space-x-2 px-3 py-1 rounded-full border border-violet-500/30 bg-violet-500/10 text-xs font-semibold tracking-wider text-violet-400 mb-6 uppercase">
              <Brain className="h-3 w-3 mr-1" />
              Next-Gen Real Estate AI
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="text-4xl sm:text-6xl font-extrabold tracking-tight mb-8 leading-[1.1] text-white"
          >
            Real-Time{" "}
            <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-400 bg-clip-text text-transparent">
              Property Valuation
            </span>{" "}
            & Market Intelligence Platform
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.3 }}
            className="text-base sm:text-lg text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed"
          >
            Predict property valuations, forecast future capital returns, and perform dynamic comparisons using algorithms and RAG AI assistants.
          </motion.p>

          {/* Quick Search Bar */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="glass-panel max-w-2xl mx-auto p-4 rounded-2xl shadow-2xl border-white/10 mb-16"
          >
            <form onSubmit={handleQuickSearch} className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 flex gap-2">
                <input
                  type="text"
                  placeholder="Enter City (e.g. Hyderabad)"
                  value={searchCity}
                  onChange={(e) => setSearchCity(e.target.value)}
                  className="w-full bg-slate-950/60 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-violet-500 transition"
                  required
                />
                <input
                  type="text"
                  placeholder="Locality (e.g. Miyapur)"
                  value={searchLoc}
                  onChange={(e) => setSearchLoc(e.target.value)}
                  className="w-full bg-slate-950/60 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-violet-500 transition"
                />
              </div>
              <button
                type="submit"
                className="bg-violet-600 hover:bg-violet-700 text-white rounded-xl px-6 py-3 font-semibold text-sm flex items-center justify-center space-x-2 transition shadow-lg shadow-violet-600/30"
              >
                <Search className="h-4 w-4" />
                <span>Search</span>
              </button>
            </form>
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-28 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {features.map((feat, idx) => {
            const Icon = feat.icon;
            return (
              <motion.div
                key={feat.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                className="glass-panel p-8 rounded-2xl hover:border-white/20 transition-all flex flex-col justify-between group"
              >
                <div>
                  <div className={`p-4 rounded-xl bg-gradient-to-br ${feat.color} w-fit text-white mb-6 shadow-lg`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-xl font-bold mb-4 text-white group-hover:text-violet-300 transition-colors">
                    {feat.title}
                  </h3>
                  <p className="text-slate-400 text-sm leading-relaxed mb-6">
                    {feat.desc}
                  </p>
                </div>
                <Link
                  to={feat.link}
                  className="text-violet-400 group-hover:text-violet-300 font-semibold text-sm flex items-center space-x-1"
                >
                  <span>Launch Tool</span>
                  <ArrowRight className="h-4 w-4 transform group-hover:translate-x-1 transition-transform" />
                </Link>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* Trust & Banner stats */}
      <section className="border-t border-white/5 bg-slate-950/40 py-16 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <div>
            <p className="text-3xl sm:text-4xl font-extrabold text-white">10K+</p>
            <p className="text-xs sm:text-sm text-slate-500 uppercase tracking-wider mt-2 font-medium">Seeded Properties</p>
          </div>
          <div>
            <p className="text-3xl sm:text-4xl font-extrabold text-white">96%</p>
            <p className="text-xs sm:text-sm text-slate-500 uppercase tracking-wider mt-2 font-medium">Valuation Confidence</p>
          </div>
          <div>
            <p className="text-3xl sm:text-4xl font-extrabold text-white">5</p>
            <p className="text-xs sm:text-sm text-slate-500 uppercase tracking-wider mt-2 font-medium">Major Indian Cities</p>
          </div>
          <div>
            <p className="text-3xl sm:text-4xl font-extrabold text-white">5K+</p>
            <p className="text-xs sm:text-sm text-slate-500 uppercase tracking-wider mt-2 font-medium">Knowledge Q&As</p>
          </div>
        </div>
      </section>

    </div>
  );
}
