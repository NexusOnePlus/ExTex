console.log('[Content] Script starting...');

// Cargar KaTeX manualmente si es necesario
async function loadKaTeX() {
    try {
        if (typeof katex !== 'undefined') {
            console.log('[Content] KaTeX already loaded');
            return true;
        }
        
        console.log('[Content] Loading KaTeX manually...');
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL('katex/katex.min.js');
        
        await new Promise((resolve, reject) => {
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
        
        console.log('[Content] KaTeX loaded successfully');
        return true;
    } catch (error) {
        console.error('[Content] Error loading KaTeX:', error);
        return false;
    }
}

// Estado global
let isProcessing = false;
let katexChecked = false;

// Verificar disponibilidad de KaTeX
async function checkKaTeX() {
    if (katexChecked) return typeof katex !== 'undefined';
    
    try {
        if (typeof katex === 'undefined') {
            await loadKaTeX();
            addCustomStyles();
        }
        
        katexChecked = true;
        const available = typeof katex !== 'undefined';
        console.log('[Content] KaTeX availability:', available);
        return available;
    } catch (error) {
        console.error('[Content] KaTeX check error:', error);
        return false;
    }
}
function addCustomStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .katex {
            color: inherit !important;
            font-size: 1.15em !important;
            text-align: left !important;
        }
        .katex-display {
            margin: 0.5em 0 !important;
            color: inherit !important;
            display: block !important;
            overflow-x: auto !important;
            max-width: 100% !important;
        }
        .katex-html {
            white-space: normal !important;
            text-align: left !important;
        }
        .message-out .katex {
            color: inherit !important;
        }
        .katex-block {
            overflow-x: auto;
            overflow-y: hidden;
            padding: 2px 0;
        }
    `;
    document.head.appendChild(style);
}


// Función para extraer y procesar fórmulas LaTeX del texto
function extractLatexFormulas(text) {
    const displayRegex = /\\\[(.*?)\\\]/g;
    const inlineRegex = /\\\((.*?)\\\)/g;
    let formulas = [];
    let match;

    // Buscar fórmulas display mode
    while ((match = displayRegex.exec(text)) !== null) {
        formulas.push({
            original: match[0],
            formula: match[1],
            displayMode: true,
            index: match.index
        });
    }

    // Buscar fórmulas inline
    while ((match = inlineRegex.exec(text)) !== null) {
        formulas.push({
            original: match[0],
            formula: match[1],
            displayMode: false,
            index: match.index
        });
    }

    return formulas;
}

// Función para procesar un elemento con LaTeX
async function processLatexElement(element) {
    // Obtener el texto completo combinando todos los spans
    let text = '';
    const spans = element.querySelectorAll('span');
    if (spans.length > 0) {
        spans.forEach(span => {
            text += span.textContent + '\n';
        });
    } else {
        text = element.innerText;
    }
    
    // Verificar si el texto contiene LaTeX
    if (!text.includes("\\(") && !text.includes("\\[")) {
        return;
    }
    // Limpiar saltos de linea
    text = text.replace(/\n/g, " ");
    console.log('[Content] Processing LaTeX text:', text);
    // console.log(text)

    try {
        // Extraer fórmulas
        const formulas = extractLatexFormulas(text);
        if (formulas.length === 0) return;

        console.log('[Content] Found formulas:', formulas.length);

        // Crear nuevo contenedor manteniendo las clases originales
        const container = document.createElement('span');
        container.className = element.className;
        
        let currentText = text;
        let offset = 0;

        // Procesar cada fórmula
        for (const formula of formulas) {
            try {
                const rendered = katex.renderToString(formula.formula.trim(), {
                    throwOnError: false,
                    displayMode: formula.displayMode,
                    output: 'html',
                    strict: false,
                    trust: true
                });

                // Crear wrapper para mantener el estilo
                const wrapper = document.createElement('span');
                wrapper.style.cssText = 'color: inherit; display: inline-block;';
                if (formula.displayMode) {
                    wrapper.style.cssText += 'width: 100%; overflow-x: auto;';
                }
                wrapper.innerHTML = rendered;

                // Reemplazar la fórmula en el texto
                const beforeFormula = currentText.substring(0, formula.index + offset);
                const afterFormula = currentText.substring(formula.index + offset + formula.original.length);
                currentText = beforeFormula + wrapper.outerHTML + afterFormula;
                offset += wrapper.outerHTML.length - formula.original.length;

            } catch (renderError) {
                console.error('[Content] Render error for formula:', formula.formula, renderError);
            }
        }

        container.innerHTML = currentText;
        
        // Reemplazar el elemento original
        if (element.parentNode) {
            element.parentNode.replaceChild(container, element);
            console.log('[Content] Element updated successfully');
        }

    } catch (error) {
        console.error('[Content] Processing error:', error);
    }
}


// Función para procesar todos los elementos con LaTeX
async function processLatexElements() {
    if (isProcessing) return;
    isProcessing = true;
    
    try {
        if (!await checkKaTeX()) {
            console.error('[Content] KaTeX not available for processing');
            return;
        }
        
        // console.log('[Content] Starting batch processing');
        const elements = document.querySelectorAll('span._ao3e.selectable-text.copyable-text');
        // console.log('[Content] Found elements:', elements.length);
        
        for (const element of elements) {
            await processLatexElement(element);
        }
    } catch (error) {
        console.error('[Content] Batch processing error:', error);
    } finally {
        isProcessing = false;
    }
}


// Configurar el observer 
function setupObserver() {
    console.log('[Content] Setting up observers');
    
    const observer = new MutationObserver((mutations) => {
        let shouldProcess = false;
        for (const mutation of mutations) {
            if (mutation.addedNodes.length > 0) {
                shouldProcess = true;
                break;
            }
        }
        
        if (shouldProcess && !isProcessing) {
            // console.log('[Content] Changes detected, processing...');
            processLatexElements();
        }
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    console.log('[Content] All observers setup complete');
}

// Función de inicialización
async function initialize() {
    console.log('[Content] Initializing...');
    
    // Esperar a que la página esté completamente cargada
    if (document.readyState !== 'complete') {
        await new Promise(resolve => window.addEventListener('load', resolve));
    }
    
    // Verificar KaTeX
    if (await checkKaTeX()) {
        console.log('[Content] KaTeX available, setting up...');
        setupObserver();
        await processLatexElements();
    } else {
        console.error('[Content] KaTeX not available');
    }
}

// Iniciar
initialize();
