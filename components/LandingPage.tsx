import React from 'react';
import { 
  GitBranch, 
  BarChart3, 
  Lightbulb, 
  ArrowRight, 
  CheckCircle2,
  Zap,
  Eye,
  Target,
  TrendingUp,
  Users,
  Calendar,
  Shield
} from 'lucide-react';

interface LandingPageProps {
  onLogin: () => void;
}

export default function LandingPage({ onLogin }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 bg-white/90 backdrop-blur-sm border-b border-gray-100 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#0A66C2] rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">in</span>
            </div>
            <span className="font-semibold text-gray-900 text-lg">Audience Visualizer</span>
          </div>
          <button
            onClick={onLogin}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0A66C2] text-white rounded-lg hover:bg-[#004182] transition-colors font-medium text-sm"
          >
            Connect with LinkedIn
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </nav>

      {/* Hero Section with Dotted Background */}
      <section className="relative pt-32 pb-24 overflow-hidden">
        {/* Dotted Grid Background */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)',
            backgroundSize: '24px 24px',
            opacity: 0.6,
          }}
        />
        
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-white via-transparent to-white pointer-events-none" />
        
        <div className="relative max-w-4xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-full text-sm font-medium mb-6">
            <Zap className="w-4 h-4" />
            Built for LinkedIn Advertisers
          </div>
          
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
            Visualize, Audit & Plan<br />
            <span className="text-[#0A66C2]">LinkedIn Campaigns</span>
          </h1>
          
          <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed">
            Finally see the full picture of your LinkedIn ad account. Understand campaign hierarchies, 
            track performance trends, and plan new strategies on a visual canvas.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <button
              onClick={onLogin}
              className="inline-flex items-center gap-3 px-8 py-4 bg-[#0A66C2] text-white rounded-xl hover:bg-[#004182] transition-all font-semibold text-lg shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30"
            >
              <div className="w-6 h-6 bg-white/20 rounded flex items-center justify-center">
                <span className="text-white font-bold text-xs">in</span>
              </div>
              Connect Your Account
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
          
          <p className="text-sm text-gray-500">
            Read-only access. We never modify your campaigns.
          </p>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Three powerful tools, one platform
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Everything you need to understand, monitor, and plan your LinkedIn advertising strategy.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {/* Visualize Feature */}
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 hover:shadow-lg transition-shadow">
              <div className="w-14 h-14 bg-purple-100 rounded-xl flex items-center justify-center mb-6">
                <Eye className="w-7 h-7 text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Visualize</h3>
              <p className="text-gray-600 mb-6">
                See your entire account structure at a glance. Navigate campaign groups, campaigns, 
                and ads in an intuitive tree view.
              </p>
              <ul className="space-y-3">
                <li className="flex items-start gap-2 text-sm text-gray-600">
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span>Hierarchical account structure</span>
                </li>
                <li className="flex items-start gap-2 text-sm text-gray-600">
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span>Targeting flow visualization</span>
                </li>
                <li className="flex items-start gap-2 text-sm text-gray-600">
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span>Remarketing audience mapping</span>
                </li>
              </ul>
            </div>
            
            {/* Audit Feature */}
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 hover:shadow-lg transition-shadow">
              <div className="w-14 h-14 bg-amber-100 rounded-xl flex items-center justify-center mb-6">
                <BarChart3 className="w-7 h-7 text-amber-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Audit</h3>
              <p className="text-gray-600 mb-6">
                Track performance trends automatically. Get alerts when campaigns need attention 
                or are performing well.
              </p>
              <ul className="space-y-3">
                <li className="flex items-start gap-2 text-sm text-gray-600">
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span>Week-over-week CTR tracking</span>
                </li>
                <li className="flex items-start gap-2 text-sm text-gray-600">
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span>Budget utilization alerts</span>
                </li>
                <li className="flex items-start gap-2 text-sm text-gray-600">
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span>Weekly automated syncs</span>
                </li>
              </ul>
            </div>
            
            {/* Ideate Feature */}
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 hover:shadow-lg transition-shadow">
              <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center mb-6">
                <Lightbulb className="w-7 h-7 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Ideate</h3>
              <p className="text-gray-600 mb-6">
                Plan new campaigns on a visual canvas. Drag and drop to build campaign structures 
                before launching.
              </p>
              <ul className="space-y-3">
                <li className="flex items-start gap-2 text-sm text-gray-600">
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span>Drag-and-drop campaign planning</span>
                </li>
                <li className="flex items-start gap-2 text-sm text-gray-600">
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span>Import live campaign data</span>
                </li>
                <li className="flex items-start gap-2 text-sm text-gray-600">
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span>Share plans with your team</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-24 relative overflow-hidden">
        {/* Dotted Grid Background */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(#e2e8f0 1px, transparent 1px)',
            backgroundSize: '32px 32px',
            opacity: 0.5,
          }}
        />
        
        <div className="relative max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              How it works
            </h2>
            <p className="text-lg text-gray-600">
              Get started in under a minute
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-12">
            <div className="text-center">
              <div className="w-16 h-16 bg-[#0A66C2] rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-500/25">
                <span className="text-white font-bold text-2xl">1</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Connect LinkedIn</h3>
              <p className="text-gray-600">
                Securely connect your LinkedIn Ads account with read-only access. We never modify your campaigns.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-[#0A66C2] rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-500/25">
                <span className="text-white font-bold text-2xl">2</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Select Account</h3>
              <p className="text-gray-600">
                Choose which ad account to visualize. Perfect for agencies managing multiple clients.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-[#0A66C2] rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-500/25">
                <span className="text-white font-bold text-2xl">3</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Explore & Plan</h3>
              <p className="text-gray-600">
                Visualize your structure, enable audits for performance tracking, and plan new campaigns.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="py-16 bg-gray-50 border-y border-gray-100">
        <div className="max-w-4xl mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div className="flex flex-col items-center">
              <Shield className="w-8 h-8 text-green-600 mb-3" />
              <h4 className="font-semibold text-gray-900 mb-1">Read-Only Access</h4>
              <p className="text-sm text-gray-600">We never modify your campaigns or data</p>
            </div>
            <div className="flex flex-col items-center">
              <Users className="w-8 h-8 text-blue-600 mb-3" />
              <h4 className="font-semibold text-gray-900 mb-1">Agency-Friendly</h4>
              <p className="text-sm text-gray-600">Manage multiple client accounts easily</p>
            </div>
            <div className="flex flex-col items-center">
              <Calendar className="w-8 h-8 text-purple-600 mb-3" />
              <h4 className="font-semibold text-gray-900 mb-1">Automated Tracking</h4>
              <p className="text-sm text-gray-600">Weekly syncs keep your data fresh</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 relative overflow-hidden">
        {/* Dotted Grid Background */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(#0A66C2 1px, transparent 1px)',
            backgroundSize: '24px 24px',
            opacity: 0.1,
          }}
        />
        
        <div className="relative max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
            Ready to see your LinkedIn campaigns clearly?
          </h2>
          <p className="text-lg text-gray-600 mb-10">
            Connect your account in seconds. No credit card required.
          </p>
          <button
            onClick={onLogin}
            className="inline-flex items-center gap-3 px-8 py-4 bg-[#0A66C2] text-white rounded-xl hover:bg-[#004182] transition-all font-semibold text-lg shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30"
          >
            <div className="w-6 h-6 bg-white/20 rounded flex items-center justify-center">
              <span className="text-white font-bold text-xs">in</span>
            </div>
            Get Started Free
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 bg-[#0A66C2] rounded flex items-center justify-center">
              <span className="text-white font-bold text-xs">in</span>
            </div>
            <span className="text-sm text-gray-600">Audience Visualizer</span>
          </div>
          <p className="text-sm text-gray-500">
            Built for LinkedIn advertisers who want clarity
          </p>
        </div>
      </footer>
    </div>
  );
}
