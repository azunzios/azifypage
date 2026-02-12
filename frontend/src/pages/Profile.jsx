import React from 'react';

export default function Profile() {
    return (
        <div className="p-8">
            <h2 className="text-3xl font-bold mb-6">User Profile</h2>

            <div className="bg-neutral-800 p-6 rounded-lg max-w-md">
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-xl font-bold">
                        U
                    </div>
                    <div>
                        <h3 className="text-xl font-bold">User</h3>
                        <p className="text-neutral-400">PikPak Premium</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="text-xs uppercase text-neutral-500 font-bold">Storage Used</label>
                        <div className="w-full bg-black rounded-full h-2 mt-1">
                            <div className="bg-blue-500 h-2 rounded-full" style={{ width: '45%' }}></div>
                        </div>
                        <div className="flex justify-between text-xs mt-1 text-neutral-400">
                            <span>450 GB</span>
                            <span>1 TB</span>
                        </div>
                    </div>

                    <div>
                        <label className="text-xs uppercase text-neutral-500 font-bold">Wallet Balance</label>
                        <p className="text-2xl font-mono text-green-400">Rp 500,000</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
