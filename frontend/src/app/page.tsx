'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

export default function Home() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <div className="container mx-auto px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-4xl mx-auto text-center"
        >
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Welcome to Mocktech
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Your AI-powered technical interview practice platform
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto mt-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="bg-white p-6 rounded-lg shadow-lg"
          >
            <div className="text-4xl mb-4">🎯</div>
            <h3 className="text-xl font-semibold mb-2">Realistic Interviews</h3>
            <p className="text-gray-600">
              Practice with AI-powered interviews that simulate real technical interviews
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="bg-white p-6 rounded-lg shadow-lg"
          >
            <div className="text-4xl mb-4">💬</div>
            <h3 className="text-xl font-semibold mb-2">Voice Interaction</h3>
            <p className="text-gray-600">
              Natural conversation flow with voice-based questions and answers
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="bg-white p-6 rounded-lg shadow-lg"
          >
            <div className="text-4xl mb-4">💻</div>
            <h3 className="text-xl font-semibold mb-2">Live Coding</h3>
            <p className="text-gray-600">
              Solve coding challenges in real-time with our integrated code editor
            </p>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.8 }}
          className="text-center mt-16"
        >
          <button
            onClick={() => router.push('/interview')}
            className="bg-indigo-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-indigo-700 transition-colors duration-200"
          >
            Start Practice Interview
          </button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 1 }}
          className="max-w-2xl mx-auto mt-16 text-center"
        >
          <h2 className="text-2xl font-semibold mb-4">How it works</h2>
          <div className="space-y-4 text-gray-600">
            <p>1. Select your target job role and experience level</p>
            <p>2. Engage in a realistic technical interview with our AI</p>
            <p>3. Solve coding challenges in real-time</p>
            <p>4. Receive instant feedback and improve your skills</p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
