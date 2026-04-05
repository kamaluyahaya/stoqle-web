"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { FaChevronLeft } from "react-icons/fa";
import { LifebuoyIcon, EnvelopeIcon, PhoneIcon, ChatBubbleLeftRightIcon } from "@heroicons/react/24/outline";

export default function AccountRecoveryPage() {
    const router = useRouter();

    return (
        <div className="min-h-screen bg-white">
            <div className="sticky top-0 z-[100] bg-white flex items-center px-4 h-14 border-b border-slate-100 shadow-sm">
                <button onClick={() => router.back()} className="p-1 -ml-1 text-slate-800">
                    <FaChevronLeft size={16} />
                </button>
                <div className="absolute left-1/2 -translate-x-1/2 text-sm font-bold text-slate-800 tracking-tight">
                    Account Recovery
                </div>
            </div>

            <div className="p-8 max-w-lg mx-auto space-y-8">
                <div className="text-center space-y-3">
                    <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto">
                        <LifebuoyIcon className="w-8 h-8 text-red-500" />
                    </div>
                    <h1 className="text-xl font-black text-slate-900">Cant access your account?</h1>
                    <p className="text-slate-500 text-sm font-medium">Choose a recovery method below to regain access to your Stoqle account.</p>
                </div>

                <div className="space-y-4">
                    <RecoveryOption 
                        icon={<EnvelopeIcon className="w-5 h-5" />} 
                        label="Recover via Email" 
                        desc="We'll send a reset link to your primary email address."
                    />
                    <RecoveryOption 
                        icon={<PhoneIcon className="w-5 h-5" />} 
                        label="Recover via Phone" 
                        desc="Receive a verification code on your linked mobile number."
                    />
                    <RecoveryOption 
                        icon={<ChatBubbleLeftRightIcon className="w-5 h-5" />} 
                        label="Contact Support" 
                        desc="Our team will manually verify your identity to help you."
                    />
                </div>

                <div className="pt-8 text-center bg-slate-50 p-6 rounded-2xl border border-dashed border-slate-200">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">Security Tip</p>
                    <p className="text-xs text-slate-500 font-medium italic">"Always ensure your contact information is up to date in Account Security to make recovery faster."</p>
                </div>
            </div>
        </div>
    );
}

function RecoveryOption({ icon, label, desc }: any) {
    return (
        <button className="w-full p-5 text-left bg-white border border-slate-200 rounded-2xl hover:border-red-500 hover:shadow-lg hover:shadow-red-500/5 transition-all group active:scale-[0.98]">
            <div className="flex gap-4">
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-red-50 group-hover:text-red-500 transition-colors">
                    {icon}
                </div>
                <div className="flex-1">
                    <h3 className="font-bold text-slate-800 text-sm">{label}</h3>
                    <p className="text-xs text-slate-500 font-medium leading-relaxed">{desc}</p>
                </div>
                <div className="self-center">
                    <FaChevronRight size={10} className="text-slate-300 group-hover:text-red-400 transition-colors" />
                </div>
            </div>
        </button>
    );
}

function FaChevronRight({ size, className }: any) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="m9 18 6-6-6-6" />
        </svg>
    )
}
