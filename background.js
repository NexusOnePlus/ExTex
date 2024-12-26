console.log('[Background] Service worker starting...');

// Cargar KaTeX
async function loadKaTeX() {
    try {
        const url = chrome.runtime.getURL('katex/katex.min.js');
        const response = await fetch(url);
        const text = await response.text();
        return new Function(text)();
    } catch (error) {
        console.error('[Background] Error loading KaTeX:', error);
        return false;
    }
}

// Estado global
let katexInstance = null;

// Manejar mensajes desde el content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('[Background] Message received:', request);
    
    if (request.type === 'CHECK_KATEX') {
        const available = typeof katex !== 'undefined';
        console.log('[Background] KaTeX check:', available);
        sendResponse({ available });
        return true;
    }
    
    if (request.type === 'RENDER_LATEX') {
        if (typeof katex === 'undefined') {
            console.error('[Background] KaTeX not available');
            sendResponse({ success: false, error: 'KaTeX not available' });
            return true;
        }
        
        try {
            console.log('[Background] Attempting to render:', request.text);
            const rendered = katex.renderToString(request.text, {
                throwOnError: false,
                displayMode: request.text.includes("\\["),
                output: 'html'
            });
            console.log('[Background] Render successful');
            sendResponse({ success: true, rendered });
        } catch (error) {
            console.error('[Background] Render error:', error);
            sendResponse({ success: false, error: error.message });
        }
        return true;
    }
});

// Inicializar
loadKaTeX().then(() => {
    console.log('[Background] KaTeX loaded:', typeof katex !== 'undefined');
});

console.log('[Background] Service worker initialized');