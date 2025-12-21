function getPageFromCode(code) {
    return Object.keys(ROUTE_MAP).find(key => ROUTE_MAP[key] === code) || 'home';
}

function preprocessMarkdown(content) {
    if (!content) return "";
    return content.replace(/(\r\n|\n|\r)(={3,})(\s*)$/gm, '\n\n---\n');
}

function escapeHtml(text) { 
    if (!text) return text; 
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); 
}

function sanitizeContent(html) { 
    return DOMPurify.sanitize(html, { 
        ALLOWED_TAGS: [
            'b', 'i', 'u', 'em', 'strong', 'a', 
            'ul', 'li', 'ol', 'p', 'br', 'img', 'font',
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'blockquote', 'code', 'pre', 'hr',
            'table', 'thead', 'tbody', 'tr', 'th', 'td',
            'div', 'span', 'strike', 'del', 's',
            'iframe' 
        ], 
        ALLOWED_ATTR: [
            'src', 'style', 'class', 'href', 'target', 'rel', 'align', 'color', 'size', 'face', 'title',
            'onclick', 'frameborder', 'allow', 'allowfullscreen', 'width', 'height'
        ] 
    }); 
}

function saveLocalPosts(data) { localStorage.setItem('aa_posts', JSON.stringify(data)); }
function loadLocalPosts() { const data = localStorage.getItem('aa_posts'); return data ? JSON.parse(data) : []; }

function saveNickname(name) {
    if(name && name !== '하포카' && name !== '익명') {
        localStorage.setItem('aa_saved_nickname', name);
    }
}
function loadSavedNickname() {
    return localStorage.getItem('aa_saved_nickname') || '';
}

async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function configureMarked() {
    const renderer = new marked.Renderer();

    renderer.link = function(href, title, text) {
        if (typeof href === 'object' && href !== null) {
            const token = href;
            href = token.href || '';
            title = token.title || '';
            text = token.text || '';
        }
        
        let cleanHref = String(href || '').trim();
        let cleanTitle = title || '';
        
        if (!/^https?:\/\//i.test(cleanHref)) {
            if (cleanHref.toLowerCase().startsWith('www.')) {
                cleanHref = 'https://' + cleanHref;
            } else if (cleanHref.toLowerCase().startsWith('youtube.com') || cleanHref.toLowerCase().startsWith('youtu.be')) {
                 cleanHref = 'https://' + cleanHref;
            }
        }

        const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
        const match = cleanHref.match(youtubeRegex);

        if (match && match[1]) {
            return `<div class="video-container"><iframe src="https://www.youtube.com/embed/${match[1]}?mute=1" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>`;
        }

        try {
            const urlObj = new URL(cleanHref);
            const h = urlObj.hostname.toLowerCase();
            
            const isYoutube = h.includes('youtube.com') || h.includes('youtu.be');
            const isGithub = h.includes('github.com');
            const isCommon = h.endsWith('.com') || h.endsWith('.net') || h.endsWith('.co.kr');

            const titleAttr = ` title="${cleanTitle || cleanHref}"`;

            if (!isYoutube && !isGithub && !isCommon) {
                 return `<span class="text-slate-500 underline decoration-dotted cursor-help"${titleAttr}>${text}</span>`;
            }
            
            return `<a href="javascript:void(0)" onclick="event.preventDefault(); window.confirmLink('${cleanHref}'); return false;"${titleAttr} class="external-link">${text}</a>`;

        } catch(e) {
            return text;
        }
    };

    marked.setOptions({
        breaks: true,
        gfm: true,
        renderer: renderer
    });
}
