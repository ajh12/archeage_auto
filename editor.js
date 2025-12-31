let isMarkdownMode = false;
let autoSaveInterval = null;
let lastRange = null;

document.addEventListener('DOMContentLoaded', () => {
    if (typeof marked !== 'undefined') {
        const renderer = new marked.Renderer();
        renderer.link = function(href, title, text) {
            return `<a href="${href}" target="_blank" class="text-blue-600 hover:underline" title="${title || ''}">${text}</a>`;
        };
        marked.use({ renderer });
    }

    if (typeof window.router === 'function') {
        const originalRouter = window.router;
        window.router = function(page, pushHistory = true) {
            if (page !== 'write') {
                clearTempPost();
            }
            originalRouter(page, pushHistory);
            if (page === 'write' && typeof window.editingPostId !== 'undefined' && window.editingPostId) {
                setTimeout(() => saveTempPost(), 200);
            }
        };
    }

    const htmlEditor = document.getElementById('editorContentHtml');
    const mdEditor = document.getElementById('editorContentMarkdown');
    const titleInput = document.getElementById('inputTitle');
    const nameInput = document.getElementById('inputName');
    const versionSelect = document.getElementById('selectedGameVersion');

    const autoSaveHandler = () => saveTempPost();

    if (htmlEditor) {
        htmlEditor.addEventListener('input', () => {
            autoSaveHandler();
            if (htmlEditor.innerText.trim() === '' && !htmlEditor.innerHTML.includes('<img') && !htmlEditor.innerHTML.includes('<iframe')) {
                 if (mdEditor) mdEditor.value = '';
            }
        });
        
        const saveSelection = () => {
            const sel = window.getSelection();
            if (sel.rangeCount > 0) {
                const range = sel.getRangeAt(0);
                if (htmlEditor.contains(range.commonAncestorContainer)) {
                    lastRange = range.cloneRange();
                }
            }
            setTimeout(updateToolbarState, 10);
        };

        htmlEditor.addEventListener('keyup', saveSelection);
        htmlEditor.addEventListener('mouseup', saveSelection);
        htmlEditor.addEventListener('click', saveSelection);
        htmlEditor.addEventListener('input', saveSelection);
        htmlEditor.addEventListener('focus', saveSelection);
    }

    if (mdEditor) {
        mdEditor.addEventListener('input', updateMarkdownPreview);
        mdEditor.addEventListener('input', autoSaveHandler);
    }
    if (titleInput) titleInput.addEventListener('input', autoSaveHandler);
    if (nameInput) nameInput.addEventListener('input', autoSaveHandler);
    
    if (versionSelect) {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'value') {
                    autoSaveHandler();
                }
            });
        });
        observer.observe(versionSelect, { attributes: true });
    }
    
    document.addEventListener('selectionchange', () => {
        if (!isMarkdownMode && document.activeElement === htmlEditor) {
            updateToolbarState();
        }
    });

    const toolbarButtons = [
        'btn-bold', 'btn-italic', 'btn-underline', 'btn-strikethrough',
        'btn-justifyLeft', 'btn-justifyCenter', 'btn-justifyRight'
    ];

    toolbarButtons.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener('mousedown', (e) => {
                e.preventDefault();
            });
        }
    });
});

function updateToolbarState() {
    const commands = [
        { cmd: 'bold', id: 'btn-bold' },
        { cmd: 'italic', id: 'btn-italic' },
        { cmd: 'underline', id: 'btn-underline' },
        { cmd: 'strikeThrough', id: 'btn-strikethrough' },
        { cmd: 'justifyLeft', id: 'btn-justifyLeft' },
        { cmd: 'justifyCenter', id: 'btn-justifyCenter' },
        { cmd: 'justifyRight', id: 'btn-justifyRight' }
    ];
    
    commands.forEach(item => {
        const btn = document.getElementById(item.id);
        if (btn) {
            let state = false;
            try {
                state = document.queryCommandState(item.cmd);
            } catch(e) {}
            
            if (state) {
                btn.classList.add('active', 'bg-blue-600', 'text-white', 'border-blue-600');
                btn.classList.remove('text-slate-500', 'hover:bg-slate-100', 'bg-white', 'border-transparent');
            } else {
                btn.classList.remove('active', 'bg-blue-600', 'text-white', 'border-blue-600');
                btn.classList.add('text-slate-500', 'hover:bg-slate-100', 'border-transparent');
            }
        }
    });

    try {
        const size = document.queryCommandValue('fontSize');
        const txt = document.getElementById('txt-font-size');
        
        if (txt) {
            let label = '보통';
            
            if (size === '1' || size === '10px' || size === 'x-small') label = '작게';
            else if (size === '3' || size === '16px' || size === 'medium') label = '보통';
            else if (size === '5' || size === '24px' || size === 'x-large') label = '크게';
            else if (size === '7' || size === '48px' || size === 'xxx-large') label = '아주 크게';
            
            else if (size === '2' || size === 'small') label = '작게';
            else if (size === '4' || size === 'large') label = '보통';
            else if (size === '6' || size === 'xx-large') label = '아주 크게';

            txt.innerText = label;
        }
    } catch(e) {}
}

window.insertHtmlAtCursor = function(html) {
    const editor = document.getElementById('editorContentHtml');
    if (!editor) return;

    if (lastRange) {
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(lastRange);
    } else {
        editor.focus();
    }

    const success = document.execCommand('insertHTML', false, html);

    if (!success) {
        const sel = window.getSelection();
        if (sel.getRangeAt && sel.rangeCount) {
            let range = sel.getRangeAt(0);
            range.deleteContents();
            
            const div = document.createElement("div");
            div.innerHTML = html;
            const frag = document.createDocumentFragment();
            let node, lastNode;
            while ((node = div.firstChild)) {
                lastNode = frag.appendChild(node);
            }
            range.insertNode(frag);

            if (lastNode) {
                range = range.cloneRange();
                range.setStartAfter(lastNode);
                range.collapse(true);
                sel.removeAllRanges();
                sel.addRange(range);
                lastRange = range.cloneRange();
            }
        }
    } else {
        const sel = window.getSelection();
        if (sel.rangeCount > 0) {
            lastRange = sel.getRangeAt(0).cloneRange();
        }
    }
    
    saveTempPost();
    setTimeout(updateToolbarState, 10);
};

function switchEditorTab(mode) {
    const tabHtml = document.getElementById('tab-html');
    const tabMarkdown = document.getElementById('tab-markdown');
    const htmlToolbar = document.getElementById('html-toolbar');
    const markdownToolbar = document.getElementById('markdown-toolbar');
    const editorContentHtml = document.getElementById('editorContentHtml');
    const markdownContainer = document.getElementById('markdown-container');

    if (tabHtml && tabHtml.disabled && mode === 'html') return;

    syncEditorContent(mode);

    if (mode === 'html') {
        isMarkdownMode = false;
        
        tabHtml.classList.add('border-blue-600', 'text-blue-600', 'bg-white');
        tabHtml.classList.remove('text-slate-500');
        tabMarkdown.classList.remove('border-blue-600', 'text-blue-600', 'bg-white');
        tabMarkdown.classList.add('text-slate-500');
        
        htmlToolbar.classList.remove('hidden');
        markdownToolbar.classList.add('hidden');
        editorContentHtml.classList.remove('hidden');
        markdownContainer.classList.add('hidden');
        
        setTimeout(updateToolbarState, 50);
    } else {
        isMarkdownMode = true;
        
        tabMarkdown.classList.add('border-blue-600', 'text-blue-600', 'bg-white');
        tabMarkdown.classList.remove('text-slate-500');
        tabHtml.classList.remove('border-blue-600', 'text-blue-600', 'bg-white');
        tabHtml.classList.add('text-slate-500');

        htmlToolbar.classList.add('hidden');
        markdownToolbar.classList.remove('hidden');
        editorContentHtml.classList.add('hidden');
        markdownContainer.classList.remove('hidden');
        markdownContainer.classList.add('flex'); 
        
        updateMarkdownPreview();
    }

    if (typeof window.currentEditorMode !== 'undefined') {
        window.currentEditorMode = mode;
    }
}

function syncEditorContent(targetMode) {
    const htmlEditor = document.getElementById('editorContentHtml');
    const mdEditor = document.getElementById('editorContentMarkdown');

    if (targetMode === 'html') {
        if (mdEditor.value.trim() !== '') {
            htmlEditor.innerHTML = marked.parse(mdEditor.value);
        } else {
             htmlEditor.innerHTML = '';
        }
    } else {
        if (htmlEditor.innerText.trim() !== '' || htmlEditor.innerHTML.includes('<img') || htmlEditor.innerHTML.includes('<iframe')) {
            mdEditor.value = htmlToMarkdown(htmlEditor.innerHTML);
            updateMarkdownPreview();
        } else {
            mdEditor.value = '';
            updateMarkdownPreview();
        }
    }
}

function htmlToMarkdown(html) {
    let text = html;
    text = text.replace(/<div[^>]*>/gi, '\n');
    text = text.replace(/<\/div>/gi, '');
    text = text.replace(/<p[^>]*>/gi, '');
    text = text.replace(/<\/p>/gi, '\n\n');
    text = text.replace(/<br\s*\/?>/gi, '\n');
    text = text.replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**');
    text = text.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**');
    text = text.replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*');
    text = text.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*');
    text = text.replace(/<u[^>]*>(.*?)<\/u>/gi, '$1'); 
    text = text.replace(/<s[^>]*>(.*?)<\/s>/gi, '~~$1~~');
    text = text.replace(/<strike[^>]*>(.*?)<\/strike>/gi, '~~$1~~');
    
    text = text.replace(/<img[^>]+src="([^">]+)"[^>]*>/gi, '\n![이미지]($1)\n');
    
    text = text.replace(/&nbsp;/g, ' ');
    text = text.replace(/&lt;/g, '<');
    text = text.replace(/&gt;/g, '>');
    text = text.replace(/&amp;/g, '&');
    return text.trim();
}

function updateMarkdownPreview() {
    const mdText = document.getElementById('editorContentMarkdown').value;
    const preview = document.getElementById('markdown-preview');
    
    const scrollTop = preview.scrollTop;

    if (typeof DOMPurify !== 'undefined' && typeof marked !== 'undefined') {
        const lines = mdText.split('\n');
        const processedLines = lines.map(line => {
            if (line.trim() === '') {
                return '\u00A0';
            }
            return line;
        });
        const processedText = processedLines.join('\n');

        preview.innerHTML = DOMPurify.sanitize(marked.parse(processedText));
    } else {
        preview.innerText = mdText;
    }

    preview.scrollTop = scrollTop;
}

function execCmd(command, value = null) {
    const editor = document.getElementById('editorContentHtml');
    
    if(editor && document.activeElement !== editor) {
        editor.focus();
        if(lastRange) {
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(lastRange);
        }
    }
    
    document.execCommand(command, false, value);
    
    if(editor) {
        editor.focus();
        setTimeout(updateToolbarState, 10);
    }
    saveTempPost(); 
}

function toggleFontSizeDropdown() {
    const menu = document.getElementById('menu-font-size');
    menu.classList.toggle('hidden');
}

function applyFontSize(size, label) {
    execCmd('fontSize', size);
    
    const txt = document.getElementById('txt-font-size');
    if(txt) txt.innerText = label;
    
    document.getElementById('menu-font-size').classList.add('hidden');
}

function insertMarkdown(syntax) {
    const textarea = document.getElementById('editorContentMarkdown');
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const before = text.substring(0, start);
    const after = text.substring(end, text.length);
    
    textarea.value = before + syntax + after;
    
    textarea.selectionStart = textarea.selectionEnd = start + syntax.length;
    textarea.focus();
    
    updateMarkdownPreview();
    saveTempPost();
}

async function insertImage(input) {
    if (!input.files || !input.files[0]) return;
    
    const file = input.files[0];
    
    try {
        if (typeof showGlobalLoader === 'function') showGlobalLoader(true);
        
        let imageUrl;
        if (typeof window.uploadImage === 'function') {
             try {
                 imageUrl = await window.uploadImage(file);
             } catch(e) {
                 console.error("Upload failed, using local URL", e);
                 imageUrl = URL.createObjectURL(file);
             }
        } else {
             imageUrl = URL.createObjectURL(file);
        }

        if(!imageUrl) {
            throw new Error("이미지 URL 생성 실패");
        }

        if (isMarkdownMode) {
            const textarea = document.getElementById('editorContentMarkdown');
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const text = textarea.value;
            const newText = text.substring(0, start) + `\n![이미지](${imageUrl})\n` + text.substring(end);
            textarea.value = newText;
            updateMarkdownPreview();
        } else {
            const imgHtml = `<img src="${imageUrl}" style="max-width:100%; margin: 10px 0;">`;
            window.insertHtmlAtCursor(imgHtml);
        }
        
        saveTempPost();
    } catch (error) {
        if (typeof openAlert === 'function') openAlert('업로드 실패', '이미지 업로드 중 오류가 발생했습니다.');
        console.error(error);
    } finally {
        if (typeof showGlobalLoader === 'function') showGlobalLoader(false);
        input.value = ''; 
    }
}

function saveTempPost() {
    const title = document.getElementById('inputTitle').value;
    const name = document.getElementById('inputName') ? document.getElementById('inputName').value : '';
    const htmlContent = document.getElementById('editorContentHtml').innerHTML;
    const mdContent = document.getElementById('editorContentMarkdown').value;
    
    if (!title && !name && !htmlContent && !mdContent && typeof editingPostId === 'undefined') return;

    const versionVal = document.getElementById('selectedGameVersion') ? document.getElementById('selectedGameVersion').value : null;

    const tempData = {
        title,
        name,
        htmlContent,
        mdContent,
        isMarkdown: isMarkdownMode,
        postId: (typeof editingPostId !== 'undefined' ? editingPostId : null),
        boardType: (typeof currentBoardType !== 'undefined' ? currentBoardType : null),
        gameVersion: versionVal,
        timestamp: new Date().getTime()
    };
    
    localStorage.setItem('tempPost', JSON.stringify(tempData));
}

function loadTempPost() {
    const saved = localStorage.getItem('tempPost');
    if (!saved) return;

    try {
        const data = JSON.parse(saved);
        const ONE_DAY = 24 * 60 * 60 * 1000;
        if (new Date().getTime() - data.timestamp > ONE_DAY) {
            localStorage.removeItem('tempPost');
            return;
        }

        const currentEditId = (typeof editingPostId !== 'undefined' ? editingPostId : null);
        
        if (data.postId) {
            if (typeof window.editingPostId !== 'undefined') window.editingPostId = data.postId;
            if (typeof window.currentBoardType !== 'undefined' && data.boardType) window.currentBoardType = data.boardType;
            if (typeof window.isWriting !== 'undefined') window.isWriting = true;

            const header = document.getElementById('write-header');
            if(header) header.innerText = "글 수정하기";
            
            const nameInp = document.getElementById('inputName');
            if(nameInp) {
                nameInp.value = data.name;
                nameInp.disabled = true; 
            }
            
            const pwInp = document.getElementById('inputPw');
            if(pwInp) pwInp.disabled = true;

            restoreEditorContent(data);
            restoreVersionUI(data.gameVersion, data.boardType);
            
            if (typeof showAlert === 'function') showAlert("작성 중이던 수정 내용을 복구했습니다.");
        } 
        else {
            if (currentEditId) return; 
            
            if (data.boardType) {
                if (typeof window.currentBoardType !== 'undefined') {
                    window.currentBoardType = data.boardType;
                }
                
                const header = document.getElementById('write-header');
                if (header) {
                    let headerText = "";
                    if (data.boardType === 'notice') headerText = "📢 공지사항 작성";
                    else if (data.boardType === 'free') headerText = "💬 자유대화방 글쓰기";
                    else if (data.boardType === 'test') headerText = "🧪 관리자 테스트 글쓰기"; 
                    else headerText = "🛠️ 오류 질문 작성";
                    header.innerText = headerText;
                }
            }

            restoreEditorContent(data);
            restoreVersionUI(data.gameVersion, data.boardType);
        }

    } catch (e) {
        console.error('Auto save load failed', e);
        localStorage.removeItem('tempPost'); 
    }
}

function restoreVersionUI(version, boardType) {
    const versionContainer = document.getElementById('version-select-container');
    if (versionContainer) {
        if (boardType === 'test' || boardType === 'free') {
            versionContainer.classList.remove('hidden');
        } else {
            versionContainer.classList.add('hidden');
        }

        const versionInput = document.getElementById('selectedGameVersion');
        const versionText = document.getElementById('txt-version-select');
        
        if (versionInput) versionInput.value = version || "";
        if (versionText) {
            let label = "선택안함";
            if(version === '1.2') label = "1.2 버전";
            else if(version === '5.0') label = "5.0 버전";
            else if(version === 'common') label = "공통";
            versionText.innerText = label;
        }
    }
}

function restoreEditorContent(data) {
    if (data.title && document.getElementById('inputTitle')) document.getElementById('inputTitle').value = data.title;
    if (!data.postId && data.name && document.getElementById('inputName')) document.getElementById('inputName').value = data.name;

    if (data.htmlContent && document.getElementById('editorContentHtml')) document.getElementById('editorContentHtml').innerHTML = data.htmlContent;
    if (data.mdContent && document.getElementById('editorContentMarkdown')) {
        document.getElementById('editorContentMarkdown').value = data.mdContent;
        updateMarkdownPreview();
    }

    const tabHtml = document.getElementById('tab-html');
    if (tabHtml) {
        tabHtml.disabled = false;
        tabHtml.classList.remove('opacity-50', 'cursor-not-allowed', 'bg-gray-100');
        tabHtml.title = "";
    }

    if (data.isMarkdown) {
        switchEditorTab('markdown');
    } else {
        switchEditorTab('html');
    }
}

function clearTempPost() {
    localStorage.removeItem('tempPost');
    
    if(document.getElementById('inputTitle')) document.getElementById('inputTitle').value = '';
    if(document.getElementById('inputName')) document.getElementById('inputName').value = '';
    if(document.getElementById('inputPw')) document.getElementById('inputPw').value = '';
    if(document.getElementById('editorContentHtml')) document.getElementById('editorContentHtml').innerHTML = '';
    if(document.getElementById('editorContentMarkdown')) document.getElementById('editorContentMarkdown').value = '';
    if(document.getElementById('markdown-preview')) document.getElementById('markdown-preview').innerHTML = '';
    
    if(document.getElementById('selectedGameVersion')) document.getElementById('selectedGameVersion').value = '';
    if(document.getElementById('txt-version-select')) document.getElementById('txt-version-select').innerText = '선택안함';
    if(document.getElementById('version-select-container')) document.getElementById('version-select-container').classList.add('hidden');

    const tabHtml = document.getElementById('tab-html');
    if (tabHtml) {
        tabHtml.disabled = false;
        tabHtml.classList.remove('opacity-50', 'cursor-not-allowed', 'bg-gray-100');
        tabHtml.title = "";
    }

    switchEditorTab('html');
    lastRange = null;
}

function setupPasteHandlers(postCallback, commentCallback) {
    const htmlEditor = document.getElementById('editorContentHtml');
    const mdEditor = document.getElementById('editorContentMarkdown');
    const cmtInput = document.getElementById('cmtContent');

    const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/i;

    const handlePaste = (e, callback, isEditor) => {
        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        let files = [];
        let hasImage = false;

        for (let i = 0; i < items.length; i++) {
            if (items[i].kind === 'file' && items[i].type.indexOf('image') !== -1) {
                const blob = items[i].getAsFile();
                files.push(blob);
                hasImage = true;
            }
        }

        if (hasImage) {
            e.preventDefault();
            if (isEditor && files.length > 0) {
                callback(files[0]);
            } else if (!isEditor && files.length > 0) {
                callback(files);
            }
            return;
        }

        if (isEditor && !isMarkdownMode) { 
            const pastedText = (e.clipboardData || window.clipboardData).getData('text');
            const match = pastedText.match(youtubeRegex);

            if (match && match[1]) {
                e.preventDefault(); 
                const videoId = match[1];
                const iframeHtml = `<div class="video-container" style="position:relative; width:100%; padding-bottom:56.25%; height:0; overflow:hidden; background:#000; margin:10px 0; border-radius:8px;">
                    <iframe src="https://www.youtube.com/embed/${videoId}" style="position:absolute; top:0; left:0; width:100%; height:100%; border:0;" frameborder="0" allowfullscreen></iframe>
                </div><p><br></p>`;
                
                window.insertHtmlAtCursor(iframeHtml);
            }
        }
    };

    if (htmlEditor) {
        htmlEditor.addEventListener('paste', (e) => handlePaste(e, postCallback, true));
    }
    if (mdEditor) {
        mdEditor.addEventListener('paste', (e) => handlePaste(e, postCallback, true));
    }
    if (cmtInput) {
        cmtInput.addEventListener('paste', (e) => handlePaste(e, commentCallback, false));
    }
}
