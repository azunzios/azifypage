import React, { useState } from 'react';
import { Plus, Trash, CheckCircle, Clock } from 'lucide-react';

export default function DownloadPage() {
    const [url, setUrl] = useState('');
    const [preview, setPreview] = useState(null);
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState('');

    const handleCheck = async () => {
        if (!url) return;
        setLoading(true);
        setMsg('Checking metadata...');
        setPreview(null);

        try {
            const res = await fetch('/api/task', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });
            const data = await res.json();

            if (res.ok) {
                setPreview(data);
                setMsg('');
            } else {
                setMsg('Error: ' + JSON.stringify(data));
            }
        } catch (e) {
            setMsg('Error: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleConfirm = () => {
        setPreview(null);
        setUrl('');
        setMsg('Task successfully added!');
        setTimeout(() => setMsg(''), 3000);
    };

    const handleCancel = async () => {
        if (!preview?.id) return;
        setLoading(true);
        try {
            await fetch('/api/task?task_id=' + preview.id, { method: 'DELETE' });
            setPreview(null);
            setMsg('Task cancelled.');
        } catch (e) {
            setMsg('Error cancelling: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-8">
            <h2 className="text-3xl font-bold mb-6">Tasks & Downloads</h2>

            {/* Add Task Section */}
            <div className="bg-neutral-800 p-6 rounded-lg mb-8 max-w-2xl">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Plus size={20} className="text-blue-500" /> Add Offline Task
                </h3>

                <div className="flex gap-2">
                    <input
                        type="text"
                        value={url}
                        onChange={e => setUrl(e.target.value)}
                        placeholder="Magnet Link / Twitter / TikTok URL..."
                        className="flex-1 bg-black border border-neutral-700 rounded px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                    />
                    <button
                        onClick={handleCheck}
                        disabled={loading}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded font-medium disabled:opacity-50"
                    >
                        {loading ? 'Checking...' : 'Check'}
                    </button>
                </div>
                {msg && <p className="mt-2 text-neutral-400 text-sm">{msg}</p>}
            </div>

            {/* Preview Modal (Inline) */}
            {preview && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
                    <div className="bg-neutral-900 border border-neutral-800 p-8 rounded-xl max-w-md w-full shadow-2xl">
                        <h3 className="text-xl font-bold mb-4">Confirm Task</h3>

                        <div className="space-y-3 mb-6">
                            <div>
                                <label className="text-xs text-neutral-500 uppercase">File Name</label>
                                <p className="font-medium truncate">{preview.name}</p>
                            </div>
                            <div className="flex justify-between">
                                <div>
                                    <label className="text-xs text-neutral-500 uppercase">Size</label>
                                    <p className="font-medium">{preview.size} <span className="text-neutral-500">({preview.size_gb})</span></p>
                                </div>
                                <div className="text-right">
                                    <label className="text-xs text-neutral-500 uppercase">Price</label>
                                    <p className="font-bold text-green-400">Rp {preview.price}</p>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs text-neutral-500 uppercase">Status</label>
                                <div className={`inline-flex items-center gap-2 px-2 py-1 rounded text-sm ${preview.cached ? 'bg-green-900/30 text-green-400' : 'bg-yellow-900/30 text-yellow-400'}`}>
                                    {preview.cached ? <CheckCircle size={14} /> : <Clock size={14} />}
                                    {preview.estimation}
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={handleCancel}
                                disabled={loading}
                                className="bg-transparent border border-neutral-700 text-neutral-300 hover:bg-neutral-800"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirm}
                                className="bg-green-600 hover:bg-green-700 text-white"
                            >
                                Confirm Payment
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Task List Placeholder */}
            <div className="text-neutral-500 italic">
                Task list persistence is not yet implemented on backend.
                Only adding tasks is currently supported.
            </div>
        </div>
    );
}
