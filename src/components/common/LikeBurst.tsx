import React from 'react';
import { motion } from 'framer-motion';
import { FaHeart } from 'react-icons/fa6';

export default function LikeBurst() {
  const particles = Array.from({ length: 8 });
  const colors = ["#EF4444", "#F43F5E", "#FB7185", "#FDA4AF"];
  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
      {particles.map((_, i) => (
        <motion.div
          key={i}
          initial={{ x: 0, y: 0, scale: 0, opacity: 1, rotate: 0 }}
          animate={{
            x: Math.cos((i * 45) * Math.PI / 180) * 45,
            y: Math.sin((i * 45) * Math.PI / 180) * 45,
            scale: [0.2, 1.2, 0],
            opacity: [1, 1, 0],
            rotate: [0, 45, 90]
          }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="absolute"
        >
          <FaHeart size={8} style={{ color: colors[i % colors.length] }} />
        </motion.div>
      ))}
    </div>
  );
}
