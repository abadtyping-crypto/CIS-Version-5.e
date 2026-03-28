import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';

/**
 * 🚀 ACIS SOVEREIGN SILENT REDIRECTOR
 * This is a 'Zero-UI' hub. It silently authenticates the request
 * with the Google Sheet Bridge and triggers an immediate download.
 */
const DownloadPage = () => {
    const { fileId } = useParams();

    useEffect(() => {
        const silentRedirect = async () => {
            try {
                const BRIDGE_URL = 'https://script.google.com/macros/s/AKfycbx6I36J8X9i8U49-eVBHpjfA4Hb6rGLUpqR7TOViDZ9_eSMO8nqEobd7I7E6QEHCR7r1A/exec'; 
                const SECRET_KEY = 'RisheeFaatih@2021';
                
                const response = await fetch(`${BRIDGE_URL}?id=${fileId}&key=${SECRET_KEY}`);
                const data = await response.json();

                if (data && data.downloadurl) {
                    // Immediate redirect to the direct Drive download URL
                    window.location.replace(data.downloadurl);
                } else {
                    console.error('File not found in registry.');
                    window.location.href = 'https://abadtyping.com';
                }
            } catch (err) {
                console.error('Redirection failed.');
                window.location.href = 'https://abadtyping.com';
            }
        };

        if (fileId) silentRedirect();
    }, [fileId]);

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-slate-100 font-sans">
             {/* Invisible placeholder to prevent flickering while redirecting */}
             <div className="w-8 h-8 rounded-full border-2 border-slate-700/50 border-t-blue-500 animate-spin opacity-20"></div>
        </div>
    );
};

export default DownloadPage;
