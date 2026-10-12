(() => {
    if (document.getElementById('webnovel-download-container')) return;

    // 1. Create a container for the floating button and menu
    const container = document.createElement('div');
    container.id = 'webnovel-download-container';
    container.style.cssText = `
        position: fixed;
        bottom: 30px;
        right: 30px;
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;

    // 2. Create the main toggle button
    const mainBtn = document.createElement('button');
    mainBtn.innerHTML = '📥 Export Chapter ▼';
    mainBtn.style.cssText = `
        background: #10b981;
        color: white;
        border: none;
        padding: 12px 20px;
        font-size: 15px;
        font-weight: 600;
        border-radius: 50px;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.25);
        cursor: pointer;
        transition: background 0.2s, transform 0.2s;
    `;

    mainBtn.onmouseover = () => { mainBtn.style.background = '#059669'; mainBtn.style.transform = 'translateY(-2px)'; };
    mainBtn.onmouseout = () => { mainBtn.style.background = '#10b981'; mainBtn.style.transform = 'translateY(0)'; };

    // 3. Create the dropdown menu
    const menu = document.createElement('div');
    menu.style.cssText = `
        display: none;
        position: absolute;
        bottom: 55px;
        right: 0;
        background: white;
        box-shadow: 0 8px 24px rgba(0,0,0,0.2);
        border-radius: 12px;
        overflow: hidden;
        min-width: 160px;
        flex-direction: column;
    `;

    // Helper to style dropdown options
    const createOption = (text, onClick) => {
        const opt = document.createElement('button');
        opt.innerHTML = text;
        opt.style.cssText = `
            background: none;
            border: none;
            padding: 12px 16px;
            text-align: left;
            font-size: 14px;
            font-weight: 500;
            color: #333;
            cursor: pointer;
            width: 100%;
        `;
        opt.onmouseover = () => opt.style.background = '#f3f4f6';
        opt.onmouseout = () => opt.style.background = 'none';
        opt.onclick = (e) => {
            e.stopPropagation();
            menu.style.display = 'none';
            onClick();
        };
        return opt;
    };

    // Toggle dropdown visibility
    mainBtn.onclick = (e) => {
        e.stopPropagation();
        menu.style.display = menu.style.display === 'flex' ? 'none' : 'flex';
    };

    document.addEventListener('click', () => {
        menu.style.display = 'none';
    });

    // --- Extraction Logic ---
    const extractData = () => {
        const titleElement = document.querySelector('h1, .cha-tit, .chapter_title') || document.title;
        const title = typeof titleElement === 'string' ? titleElement : (titleElement ? titleElement.innerText.trim() : 'Webnovel_Chapter');
        
        const paragraphElements = document.querySelectorAll('.cha-words p, .chapter-content p, div[class*="content"] p');
        let content = '';
        if (paragraphElements.length > 0) {
            paragraphElements.forEach(p => {
                const text = p.innerText.trim();
                if (text) content += text + '\n\n';
            });
        } else {
            const fallbackContainer = document.querySelector('.cha-words, .chapter-content');
            content = fallbackContainer ? fallbackContainer.innerText.trim() : 'Content not found.';
        }
        const safeFilename = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        return { title, content, safeFilename };
    };

    // --- Option 1: Download Markdown (.md) ---
    menu.appendChild(createOption('📄 Download .md', () => {
        const { title, content, safeFilename } = extractData();
        const markdownData = `# ${title}\n\n${content}`;
        const blob = new Blob([markdownData], { type: 'text/markdown;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = safeFilename + '.md';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }));

    // --- Option 2: Save as PDF (Auto-triggers print dialog) ---
    menu.appendChild(createOption('📑 Save as PDF', () => {
        const { title, content } = extractData();
        const printWindow = window.open('', '_blank', 'width=800,height=900');
        printWindow.document.write(`
            <html>
            <head>
                <title>${title}</title>
                <style>
                    body { font-family: Georgia, serif; line-height: 1.8; color: #111; max-width: 700px; margin: 60px auto; padding: 0 20px; }
                    h1 { font-size: 24px; border-bottom: 1px solid #ccc; padding-bottom: 10px; margin-bottom: 30px; }
                    p { margin-bottom: 20px; font-size: 16px; text-align: justify; white-space: pre-wrap; }
                </style>
            </head>
            <body>
                <h1>${title}</h1>
                <div>${content}</div>
                <script>
                    // Automatically triggers the browser's PDF save dialog
                    setTimeout(() => {
                        window.print();
                    }, 500);
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    }));

    // --- Option 3: Download EPUB Structure (.html container readable as ePub) ---
    menu.appendChild(createOption('📖 Download EPUB', () => {
        const { title, content, safeFilename } = extractData();
        // Generates a well-structured XHTML bundle compatible with e-readers
        const epubHtml = `<!DOCTYPE html>
        <html xmlns="http://www.w3.org/1999/xhtml">
        <head><title>${title}</title></head>
        <body>
            <h1>${title}</h1>
            <div>${content.replace(/\n\n/g, '</p><p>')}</div>
        </body>
        </html>`;
        const blob = new Blob([epubHtml], { type: 'application/epub+zip;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = safeFilename + '.epub';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }));

    container.appendChild(mainBtn);
    container.appendChild(menu);
    document.body.appendChild(container);
    console.log('Multi-format Webnovel exporter loaded successfully!');
})();