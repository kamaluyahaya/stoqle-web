"use client";

import React from "react";

export const MessageWelcome: React.FC = () => {
    return (
        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gray-50 bg-chat-pattern transition-all animate-fadeIn">
            <div className="relative mb-6">
                <div className="w-24 h-24 bg-rose-100 rounded-full flex items-center justify-center shadow-lg transform transition-transform hover:scale-110">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-12 w-12 text-rose-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                        />
                    </svg>
                </div>
                <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-white border-2 border-rose-500 rounded-full flex items-center justify-center animate-bounce shadow-md">
                    <span className="text-rose-500 text-xs font-bold font-serif underline">S</span>
                </div>
            </div>

            <h2 className="text-2xl font-bold text-gray-900 mb-2 mt-4 text-center">
                Welcome to your <span className="text-rose-500">Messages</span>
            </h2>
            <p className="text-md text-gray-500 max-w-sm text-center leading-relaxed font-medium">
                Select a contact from the sidebar to view your chat history and start a conversation.
            </p>

            <div className="mt-12 grid grid-cols-2 gap-6 w-full max-w-md opacity-30 select-none pointer-events-none">
                <div className="h-2 rounded bg-gray-200"></div>
                <div className="h-2 rounded bg-gray-200 w-3/4 justify-self-end"></div>
                <div className="h-2 rounded bg-gray-200 w-1/2"></div>
                <div className="h-2 rounded bg-gray-200 w-full"></div>
            </div>
        </div>
    );
};
