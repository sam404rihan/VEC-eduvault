"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, Share2, X } from "lucide-react";

const PostPage = () => {
  const [showComments, setShowComments] = useState(null);

  const posts = [
    {
      id: 1,
      title: "📚 The Future of Online Learning",
      date: "April 23, 2025",
      img: "https://source.unsplash.com/800x400/?online-learning",
      desc: "Online learning is transforming education. What does the future hold for this mode of learning? Let's dive into trends and opportunities.",
    },
    {
      id: 2,
      title: "🧠 Critical Thinking Skills for Students",
      date: "March 20, 2025",
      img: "https://source.unsplash.com/800x400/?critical-thinking",
      desc: "Critical thinking is one of the most important skills. Here's how to develop and nurture it in classrooms.",
    },
    {
      id: 3,
      title: "🌐 The Impact of AI in Education",
      date: "February 11, 2025",
      img: "https://source.unsplash.com/800x400/?ai-education",
      desc: "AI is revolutionizing how we approach learning. Let's explore its impact on education.",
    },
    {
      id: 4,
      title: "🎓 Value of Lifelong Learning",
      date: "January 4, 2025",
      img: "https://source.unsplash.com/800x400/?lifelong-learning",
      desc: "Lifelong learning is essential today. Here's why continuous education keeps us sharp and competitive.",
    },
    {
      id: 5,
      title: "💡 Innovative STEM Education Ideas",
      date: "December 18, 2024",
      img: "https://source.unsplash.com/800x400/?stem-education",
      desc: "STEM education drives innovation. Let’s explore creative ways to teach science and tech.",
    },
  ];

  return (
    <div className="min-h-screen bg-[#f9f6f4] py-12 px-6 font-sans">
      <div className="max-w-5xl mx-auto space-y-12">
        {posts.map((post, i) => (
          <motion.div
            key={post.id}
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: i * 0.1 }}
            className="relative w-full max-w-3xl mx-auto bg-white border border-gray-200 rounded-[2rem] shadow-2xl hover:shadow-[0_20px_40px_rgba(0,0,0,0.1)] transition-all duration-300"
          >
            <img
              src={post.img}
              alt={post.title}
              className="w-full h-64 object-cover rounded-t-[2rem]"
            />
            <div className="p-6">
              <h2 className="text-3xl font-semibold text-gray-900 mb-2 tracking-tight">
                {post.title}
              </h2>
              <p className="text-xs text-gray-400 mb-4">{post.date}</p>
              <p className="text-gray-700 leading-relaxed text-base mb-4">
                {post.desc}
              </p>

              {/* Buttons and Floating Comments */}
              <div className="flex items-center gap-6 relative mt-6">
                <AnimatePresence>
                  {showComments === post.id && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute bottom-full left-0 w-full z-50 mb-3 px-4"
                    >
                      <div className="backdrop-blur-md bg-white/90 border border-gray-200 rounded-2xl shadow-lg px-5 py-4">
                        <div className="flex justify-between items-center mb-3">
                          <h3 className="text-lg font-semibold text-gray-800">
                            💬 Comments
                          </h3>
                          <button onClick={() => setShowComments(null)}>
                            <X className="w-5 h-5 text-gray-400 hover:text-gray-600" />
                          </button>
                        </div>
                        <div className="space-y-4 text-sm text-gray-700">
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-gray-300 shadow-inner"></div>
                            <p><strong>Alex:</strong> Insightful post! 👏</p>
                          </div>
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-gray-300 shadow-inner"></div>
                            <p><strong>Mira:</strong> Love this perspective. 🌟</p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <button
                  onClick={() =>
                    setShowComments(
                      showComments === post.id ? null : post.id
                    )
                  }
                  className="flex items-center gap-2 text-sm px-4 py-1.5 rounded-full border border-blue-200 text-blue-600 hover:bg-blue-50 transition-all"
                >
                  <MessageCircle className="w-4 h-4" />
                  {showComments === post.id ? "Hide Comments" : "Show Comments"}
                </button>

                <button className="flex items-center gap-2 text-sm px-4 py-1.5 rounded-full border border-gray-200 text-gray-700 hover:bg-gray-100 transition-all">
                  <Share2 className="w-4 h-4" />
                  Share
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default PostPage;
