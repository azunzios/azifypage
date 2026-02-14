import React, { useEffect, useState, useCallback } from 'react';

export default function Dashboard() {
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentFolderId, setCurrentFolderId] = useState(''); // Empty string = user's root folder
    const [folderHistory, setFolderHistory] = useState([{ id: '', name: 'My Files' }]); // Navigation history
    const [historyIndex, setHistoryIndex] = useState(0); // Current position in history
    const [breadcrumb, setBreadcrumb] = useState([{ id: '', name: 'My Files' }]); // Breadcrumb path
    const [downloadingFolder, setDownloadingFolder] = useState({ id: '', done: 0, total: 0 });

    // Fetch files for a given folder
    const fetchFiles = useCallback((folderId = '') => {
        setLoading(true);
        const url = folderId ? `/api/files?parent_id=${folderId}` : '/api/files';
        fetch(url)
            .then(res => res.json())
            .then(data => {
                setFiles(data || []);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, []);

    // Initial load
    useEffect(() => {
        fetchFiles(currentFolderId);
    }, [currentFolderId, fetchFiles]);

    // Navigate into a folder
    const navigateToFolder = (folderId, folderName) => {
        // Update breadcrumb
        const currentBreadcrumbIndex = breadcrumb.findIndex(b => b.id === currentFolderId);
        const newBreadcrumb = [...breadcrumb.slice(0, currentBreadcrumbIndex + 1), { id: folderId, name: folderName }];
        setBreadcrumb(newBreadcrumb);

        // Update history (cut off any forward history if we navigate to a new folder)
        const newHistory = [...folderHistory.slice(0, historyIndex + 1), { id: folderId, name: folderName }];
        setFolderHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);

        setCurrentFolderId(folderId);
    };

    // Go back in history
    const goBack = () => {
        if (historyIndex > 0) {
            const newIndex = historyIndex - 1;
            const targetFolder = folderHistory[newIndex];
            setHistoryIndex(newIndex);
            setCurrentFolderId(targetFolder.id);

            // Update breadcrumb to match
            const breadcrumbIndex = breadcrumb.findIndex(b => b.id === targetFolder.id);
            if (breadcrumbIndex !== -1) {
                setBreadcrumb(breadcrumb.slice(0, breadcrumbIndex + 1));
            }
        }
    };

    // Go forward in history
    const goForward = () => {
        if (historyIndex < folderHistory.length - 1) {
            const newIndex = historyIndex + 1;
            const targetFolder = folderHistory[newIndex];
            setHistoryIndex(newIndex);
            setCurrentFolderId(targetFolder.id);

            // Find the correct breadcrumb or add it
            if (!breadcrumb.find(b => b.id === targetFolder.id)) {
                setBreadcrumb([...breadcrumb, targetFolder]);
            }
        }
    };

    // Go up to parent folder
    const goUp = () => {
        if (breadcrumb.length > 1) {
            const parentFolder = breadcrumb[breadcrumb.length - 2];
            navigateToBreadcrumb(parentFolder.id, breadcrumb.length - 2);
        }
    };

    // Navigate to a specific breadcrumb item
    const navigateToBreadcrumb = (folderId, index) => {
        const newBreadcrumb = breadcrumb.slice(0, index + 1);
        setBreadcrumb(newBreadcrumb);

        const targetFolder = breadcrumb[index];
        const newHistory = [...folderHistory.slice(0, historyIndex + 1), targetFolder];
        setFolderHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);

        setCurrentFolderId(folderId);
    };

    // Refresh current folder
    const refresh = () => {
        fetchFiles(currentFolderId);
    };

    // Handle getting download link
    const handleGetLink = async (file) => {
        try {
            const fileId = file?.id;
            const fileName = file?.name || '';
            window.open(`/api/file/download?file_id=${encodeURIComponent(fileId)}&file_name=${encodeURIComponent(fileName)}`, '_blank');
        } catch (err) {
            console.error('Failed to get download link:', err);
        }
    };

    const getOrCreateDir = async (rootHandle, folderPath) => {
        if (!folderPath || folderPath === '.') return rootHandle;
        const parts = folderPath.split('/').filter(Boolean);
        let current = rootHandle;
        for (const part of parts) {
            current = await current.getDirectoryHandle(part, { create: true });
        }
        return current;
    };

    const downloadFileToDirectory = async (rootHandle, item) => {
        const normalized = (item.relative_path || item.name || '').replace(/^\/+/, '');
        const parts = normalized.split('/').filter(Boolean);
        const fileName = parts.pop() || item.name || item.file_id;
        const folderPath = parts.join('/');
        const dirHandle = await getOrCreateDir(rootHandle, folderPath);
        const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });

        const res = await fetch(item.web_content_link);
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }

        const writable = await fileHandle.createWritable();
        if (res.body && writable && typeof res.body.pipeTo === 'function') {
            await res.body.pipeTo(writable);
            return;
        }

        const blob = await res.blob();
        await writable.write(blob);
        await writable.close();
    };

    const handleDownloadFolder = async (file) => {
        const isDesktop = !/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
        const isChromeOrEdge = /Chrome|Edg/i.test(navigator.userAgent);
        if (!window.showDirectoryPicker || !isDesktop || !isChromeOrEdge) {
            alert('Download folder langsung hanya didukung di Chrome/Edge desktop (Windows/macOS/Linux).');
            return;
        }

        try {
            const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
            const res = await fetch(`/api/folder/manifest?folder_id=${file.id}&folder_name=${encodeURIComponent(file.name)}&format=json`);
            if (!res.ok) {
                const text = await res.text();
                throw new Error(text || `HTTP ${res.status}`);
            }

            const data = await res.json();
            const items = Array.isArray(data?.items) ? data.items.filter((item) => item?.web_content_link) : [];
            if (!items.length) {
                alert('Tidak ada file yang bisa diunduh pada folder ini.');
                return;
            }

            setDownloadingFolder({ id: file.id, done: 0, total: items.length });

            const concurrency = 3;
            const queue = [...items];
            const failed = [];

            const worker = async () => {
                while (queue.length > 0) {
                    const item = queue.shift();
                    if (!item) continue;
                    try {
                        await downloadFileToDirectory(dirHandle, item);
                    } catch (err) {
                        failed.push({ name: item.relative_path || item.name, error: err?.message || 'unknown error' });
                    } finally {
                        setDownloadingFolder((prev) => {
                            if (prev.id !== file.id) return prev;
                            return { ...prev, done: prev.done + 1 };
                        });
                    }
                }
            };

            await Promise.all(Array.from({ length: concurrency }, () => worker()));

            if (failed.length > 0) {
                alert(`Download selesai dengan ${failed.length} gagal. Klik lagi untuk retry.`);
            } else {
                alert('Download folder selesai.');
            }
        } catch (err) {
            if (err?.name === 'AbortError') return;
            console.error('Failed to download folder directly:', err);
            alert(`Gagal download langsung: ${err?.message || 'unknown error'}`);
        } finally {
            setDownloadingFolder({ id: '', done: 0, total: 0 });
        }
    };

    const canGoBack = historyIndex > 0;
    const canGoForward = historyIndex < folderHistory.length - 1;
    const canGoUp = breadcrumb.length > 1;

    return (
        <div className="p-8">
            {/* Navigation Toolbar - Windows Explorer Style */}
            <div className="flex items-center gap-2 mb-4 bg-neutral-800/50 p-3 rounded-lg border border-neutral-700">
                {/* Back Button */}
                <button
                    onClick={goBack}
                    disabled={!canGoBack}
                    className={`p-2 rounded-lg transition-all ${canGoBack
                            ? 'hover:bg-neutral-700 text-white'
                            : 'text-neutral-600 cursor-not-allowed'
                        }`}
                    title="Back (Alt+Left)"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </button>

                {/* Forward Button */}
                <button
                    onClick={goForward}
                    disabled={!canGoForward}
                    className={`p-2 rounded-lg transition-all ${canGoForward
                            ? 'hover:bg-neutral-700 text-white'
                            : 'text-neutral-600 cursor-not-allowed'
                        }`}
                    title="Forward (Alt+Right)"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </button>

                {/* Up Button */}
                <button
                    onClick={goUp}
                    disabled={!canGoUp}
                    className={`p-2 rounded-lg transition-all ${canGoUp
                            ? 'hover:bg-neutral-700 text-white'
                            : 'text-neutral-600 cursor-not-allowed'
                        }`}
                    title="Up (Alt+Up)"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                </button>

                {/* Separator */}
                <div className="w-px h-6 bg-neutral-600 mx-1"></div>

                {/* Refresh Button */}
                <button
                    onClick={refresh}
                    className="p-2 rounded-lg hover:bg-neutral-700 text-white transition-all"
                    title="Refresh (F5)"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                </button>

                {/* Separator */}
                <div className="w-px h-6 bg-neutral-600 mx-1"></div>

                {/* Breadcrumb Navigation */}
                <div className="flex-1 flex items-center bg-neutral-900 rounded-lg px-3 py-2 border border-neutral-700">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-neutral-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                    <div className="flex items-center gap-1 text-sm overflow-x-auto">
                        {breadcrumb.map((item, index) => (
                            <React.Fragment key={item.id || 'root'}>
                                {index > 0 && (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-neutral-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                )}
                                <button
                                    onClick={() => navigateToBreadcrumb(item.id, index)}
                                    className={`px-2 py-1 rounded hover:bg-neutral-700 transition-colors whitespace-nowrap ${index === breadcrumb.length - 1
                                            ? 'text-white font-medium'
                                            : 'text-neutral-400 hover:text-white'
                                        }`}
                                >
                                    {item.name}
                                </button>
                            </React.Fragment>
                        ))}
                    </div>
                </div>
            </div>

            {/* File List */}
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <div className="flex items-center gap-3 text-neutral-400">
                        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Loading files...
                    </div>
                </div>
            ) : (
                <div className="overflow-x-auto border border-neutral-800 rounded-lg">
                    <table className="w-full text-left text-sm text-neutral-400">
                        <thead className="bg-neutral-800 text-neutral-200 uppercase font-medium text-xs">
                            <tr>
                                <th className="px-6 py-3">Name</th>
                                <th className="px-6 py-3">Size</th>
                                <th className="px-6 py-3">Modified</th>
                                <th className="px-6 py-3">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-800">
                            {files.map(file => (
                                <tr
                                    key={file.id}
                                    className="hover:bg-neutral-800/50 transition-colors group"
                                    onDoubleClick={() => {
                                        if (file.kind === 'drive#folder') {
                                            navigateToFolder(file.id, file.name);
                                        }
                                    }}
                                >
                                    <td className="px-6 py-3">
                                        {file.kind === 'drive#folder' ? (
                                            <button
                                                onClick={() => navigateToFolder(file.id, file.name)}
                                                className="flex items-center gap-3 hover:text-blue-400 transition-colors text-left w-full"
                                            >
                                                <span className="text-lg">📁</span>
                                                <span className="text-white font-medium group-hover:text-blue-400">{file.name}</span>
                                            </button>
                                        ) : (
                                            <div className="flex items-center gap-3">
                                                <span className="text-lg">📄</span>
                                                <span className="text-white font-medium">{file.name}</span>
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-3 text-neutral-500">{file.kind === 'drive#folder' ? '-' : file.size_str}</td>
                                    <td className="px-6 py-3 text-neutral-500">{file.modified_str}</td>
                                    <td className="px-6 py-3">
                                        {file.kind === 'drive#folder' ? (
                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={() => navigateToFolder(file.id, file.name)}
                                                    className="text-blue-400 hover:text-blue-300 hover:underline bg-transparent border-0 p-0 text-sm"
                                                >
                                                    Open
                                                </button>
                                                <span className="text-neutral-600">|</span>
                                                <button
                                                    onClick={() => handleDownloadFolder(file)}
                                                    disabled={downloadingFolder.id === file.id}
                                                    className="text-purple-400 hover:text-purple-300 hover:underline bg-transparent border-0 p-0 text-sm"
                                                >
                                                    {downloadingFolder.id === file.id
                                                        ? `Downloading ${downloadingFolder.done}/${downloadingFolder.total}`
                                                        : 'Download All'}
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => handleGetLink(file)}
                                                className="text-green-400 hover:text-green-300 hover:underline bg-transparent border-0 p-0 text-sm"
                                            >
                                                Get Link
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {files.length === 0 && (
                                <tr>
                                    <td colSpan="4" className="px-6 py-12 text-center">
                                        <div className="flex flex-col items-center gap-2">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                            </svg>
                                            <span className="text-neutral-500">This folder is empty</span>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Status Bar */}
            <div className="mt-4 flex items-center justify-between text-xs text-neutral-500 px-2">
                <span>{files.length} item{files.length !== 1 ? 's' : ''}</span>
                <span className="text-neutral-600">Double-click folder to open</span>
            </div>
        </div>
    );
}
