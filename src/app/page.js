"use client";
import React, { useState, useEffect } from 'react';
import { Palette, Users, Zap, Globe, ArrowRight, Sparkles, Layers } from 'lucide-react';

export default function CanvassLanding() {
  const [scrollY, setScrollY] = useState(0);
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    const handleMouseMove = (e) => setCursorPos({ x: e.clientX, y: e.clientY });
    
    window.addEventListener('scroll', handleScroll);
    window.addEventListener('mousemove', handleMouseMove);
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  const features = [
    {
      icon: Users,
      title: "Collaborative Drawing",
      description: "Create together in real-time with your team, no matter where they are"
    },
    {
      icon: Zap,
      title: "Real-Time Sync",
      description: "See every stroke instantly with lightning-fast synchronization"
    },
    {
      icon: Globe,
      title: "Work Anywhere",
      description: "Browser-based platform accessible from any device, anywhere"
    },
    {
      icon: Layers,
      title: "Infinite Canvas",
      description: "Unlimited space for your creativity to flow without boundaries"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 text-white overflow-hidden">
      {/* Animated background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div 
          className="absolute w-96 h-96 bg-purple-500/20 rounded-full blur-3xl"
          style={{
            left: `${cursorPos.x * 0.02}px`,
            top: `${cursorPos.y * 0.02}px`,
            transition: 'all 0.3s ease-out'
          }}
        />
        <div 
          className="absolute w-96 h-96 bg-blue-500/20 rounded-full blur-3xl right-0 bottom-0"
          style={{
            right: `${cursorPos.x * 0.01}px`,
            bottom: `${cursorPos.y * 0.01}px`,
            transition: 'all 0.3s ease-out'
          }}
        />
      </div>

      {/* Navigation */}
      <nav className="relative z-50 px-6 py-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Palette className="w-8 h-8 text-purple-400" />
            <span className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Canvass
            </span>
          </div>
          <div className="hidden md:flex items-center space-x-8">
            <a href="#features" className="hover:text-purple-400 transition-colors">Features</a>
            <a href="#how" className="hover:text-purple-400 transition-colors">How It Works</a>
            <a href="#pricing" className="hover:text-purple-400 transition-colors">Pricing</a>
          </div>
          <button className="bg-gradient-to-r from-purple-500 to-pink-500 px-6 py-2.5 rounded-full font-semibold hover:shadow-lg hover:shadow-purple-500/50 transition-all duration-300 hover:scale-105">
            Get Started
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 px-6 pt-20 pb-32">
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center space-x-2 bg-purple-500/10 backdrop-blur-sm border border-purple-500/20 rounded-full px-4 py-2 mb-8">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span className="text-sm text-purple-300">Now supporting unlimited users</span>
          </div>
          
          <h1 
            className="text-6xl md:text-8xl font-bold mb-6 leading-tight"
            style={{
              transform: `translateY(${scrollY * 0.1}px)`,
            }}
          >
            Create{' '}
            <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent animate-gradient">
              Together
            </span>
            <br />
            Draw as One
          </h1>
          
          <p className="text-xl md:text-2xl text-slate-300 mb-12 max-w-3xl mx-auto">
            The collaborative drawing platform where creativity meets in real-time. 
            Multiple cursors, infinite possibilities.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button className="group bg-gradient-to-r from-purple-500 to-pink-500 px-8 py-4 rounded-full font-semibold text-lg hover:shadow-2xl hover:shadow-purple-500/50 transition-all duration-300 hover:scale-105 flex items-center space-x-2">
              <span>Start Drawing Now</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <button className="px-8 py-4 rounded-full font-semibold text-lg border-2 border-purple-500/30 hover:border-purple-500 hover:bg-purple-500/10 transition-all duration-300">
              Watch Demo
            </button>
          </div>

          {/* Canvas Preview */}
          <div className="mt-20 relative">
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent z-10" />
            <div className="bg-slate-900/50 backdrop-blur-xl border border-purple-500/20 rounded-3xl p-4 shadow-2xl shadow-purple-500/20 transform hover:scale-[1.02] transition-transform duration-500">
              <div className="bg-slate-950 rounded-2xl aspect-video flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-pink-500/10" />
                {/* Simulated drawing cursors */}
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="absolute w-4 h-4 rounded-full"
                    style={{
                      background: ['#a855f7', '#ec4899', '#06b6d4'][i],
                      left: `${30 + i * 20}%`,
                      top: `${40 + i * 10}%`,
                      animation: `float ${3 + i}s ease-in-out infinite`,
                      animationDelay: `${i * 0.5}s`,
                      boxShadow: `0 0 20px ${['#a855f7', '#ec4899', '#06b6d4'][i]}`
                    }}
                  />
                ))}
                <div className="relative z-10 text-center">
                  <Palette className="w-20 h-20 text-purple-400 mx-auto mb-4 opacity-50" />
                  <p className="text-slate-400">Your canvas comes alive here</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="relative z-10 px-6 py-32 bg-slate-900/30 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-5xl md:text-6xl font-bold mb-6">
              Built for{' '}
              <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                Collaboration
              </span>
            </h2>
            <p className="text-xl text-slate-300 max-w-2xl mx-auto">
              Everything you need to create, collaborate, and bring your ideas to life
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div
                  key={index}
                  className="group bg-slate-900/50 backdrop-blur-xl border border-purple-500/20 rounded-2xl p-8 hover:border-purple-500/50 transition-all duration-300 hover:transform hover:scale-105 hover:shadow-xl hover:shadow-purple-500/20"
                  style={{
                    animationDelay: `${index * 0.1}s`
                  }}
                >
                  <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 w-14 h-14 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    <Icon className="w-7 h-7 text-purple-400" />
                  </div>
                  <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                  <p className="text-slate-400">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 px-6 py-32">
        <div className="max-w-4xl mx-auto text-center">
          <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 backdrop-blur-xl border border-purple-500/30 rounded-3xl p-12 md:p-16">
            <h2 className="text-4xl md:text-6xl font-bold mb-6">
              Ready to Create Something Amazing?
            </h2>
            <p className="text-xl text-slate-300 mb-8">
              Join thousands of teams already collaborating on Canvass
            </p>
            <button className="bg-gradient-to-r from-purple-500 to-pink-500 px-10 py-5 rounded-full font-semibold text-lg hover:shadow-2xl hover:shadow-purple-500/50 transition-all duration-300 hover:scale-105 inline-flex items-center space-x-2">
              <span>Start Drawing for Free</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 px-6 py-12 border-t border-purple-500/20">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between">
          <div className="flex items-center space-x-2 mb-4 md:mb-0">
            <Palette className="w-6 h-6 text-purple-400" />
            <span className="text-xl font-bold">Canvass</span>
          </div>
          <div className="text-slate-400 text-sm">
            © 2024 Canvass. All rights reserved.
          </div>
        </div>
      </footer>

      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(20px, -20px); }
        }
        
        @keyframes gradient {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        
        .animate-gradient {
          background-size: 200% auto;
          animation: gradient 3s ease infinite;
        }
      `}</style>
    </div>
  );
}