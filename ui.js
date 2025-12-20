import { ROUTE_MAP, PAGE_TITLES, ENABLE_SNOW, particlesConfig } from './config.js';
import { escapeHtml, preprocessMarkdown, sanitizeContent } from './utils.js';

export function router(page, isAdmin) {
    if (page === 'error') page = 'list';

    document.title = PAGE_TITLES[page] || '하포카 해결소';

    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
    
    const footer = document.getElementById('main-footer');
    if(page === 'write') {
        if(footer) footer.classList.add('hidden');
    } else {
        if(footer) footer.classList.remove('hidden');
    }

    if(['notice','free','list'].includes(page)) {
        document.getElementById('view-board').classList.remove('hidden');
    } else {
        const target = document.getElementById(`view-${page}`);
        if(target) target.classList.remove('hidden');
    }

    window.scrollTo(0, 0);

    const snowContainer = document.getElementById('snow-container');
    if (snowContainer) {
        if (page === 'home' && ENABLE_SNOW) {
            snowContainer.style.display = 'block';
            snowContainer.style.zIndex = '1';
            snowContainer.style.pointerEvents = 'none';
            
            if (typeof particlesJS !== 'undefined' && !window.isSnowInitialized) {
                particlesJS('snow-container', particlesConfig);
                window.isSnowInitialized = true;
            }
        } else {
            snowContainer.style.display = 'none';
        }
    }
}

export function showAlert(msg, title = "알림") {
    document.getElementById('alertTitle').innerText = title;
    document.getElementById('alertMessage').innerText = msg;
    document.getElementById('alertModal').classList.remove('hidden');
    setTimeout(() => document.getElementById('alertOkBtn').focus(), 50);
}

export function showContentModal(htmlContent, title = "내용 확인") {
    document.getElementById('alertTitle').innerText = title;
    document.getElementById('alertMessage').innerHTML = htmlContent; 
    document.getElementById('alertModal').classList.remove('hidden');
}

export function closeAlert() {
    document.getElementById('alertModal').classList.add('hidden');
    document.getElementById('alertMessage').innerText = "";
    
    if(!document.getElementById('passwordModal').classList.contains('hidden')) {
        document.getElementById('verificationPw').focus();
    }
}

export function showConfirm(msg, callback, title = "확인", btnText = "삭제") {
    document.getElementById('confirmTitle').innerText = title;
    document.getElementById('confirmMessage').innerText = msg;
    document.getElementById('btn-confirm-yes').innerText = btnText;
    window.confirmCallback = callback;
    document.getElementById('confirmModal').classList.remove('hidden');
}

export function closeConfirm() {
    document.getElementById('confirmModal').classList.add('hidden');
    window.confirmCallback = null;
}

export function renderPostList(posts, containerId, viewMode, currentBoardType, isAdmin) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    
    if(posts.length === 0) { 
        container.innerHTML = `<div class="col-span-full text-center py-20 text-slate-400">게시글이 없습니다.</div>`; 
        return; 
    }

    if(currentBoardType === 'error') {
        if(viewMode === 'grid') container.className = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6";
        else container.className = "flex flex-col gap-3";
    } else if(currentBoardType === 'free') {
        container.className = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6";
    } else {
        container.className = "flex flex-col gap-3";
    }

    posts.forEach(post => {
        const safeTitle = escapeHtml(post.title);
        let authorBadge = '';
        if(post.author === '하포카' || post.author === 'Admin') authorBadge = `<span class="admin-badge-icon"><i class="fa-solid fa-circle-check"></i></span>`;

        let ipTag = '';
        if(isAdmin) {
            let rawIp = post.ip || 'Unknown';
            ipTag = `<span class="ml-2 text-[10px] text-red-400 font-bold font-mono" title="${rawIp}">(${rawIp})</span>`;
        }

        const cmtCount = post.comments ? post.comments.length : 0;
        const displayImg = post.image_url || post.image;
        const pinnedClass = post.is_pinned ? 'pinned-post' : '';
        const pinnedBadge = post.is_pinned ? '<div class="pinned-badge"><i class="fa-solid fa-thumbtack"></i></div>' : '';
        
        let cardStyle = "bg-white border-slate-200";
        if(post.reports >= 5) {
            cardStyle = "bg-red-50 border-red-300 ring-2 ring-red-200";
        }

        let html = '';
        if(container.className.includes('grid')) {
            let imgHtml = displayImg ? `<div class="h-40 bg-slate-100 overflow-hidden group relative"><img src="${displayImg}" class="w-full h-full object-cover transition duration-500 group-hover:scale-105"></div>` : `<div class="h-40 bg-slate-50 flex items-center justify-center text-slate-300 text-3xl"><i class="fa-solid ${currentBoardType==='free'?'fa-comments':'fa-terminal'}"></i></div>`;
            html = `<div onclick="window.readPost('${post.id}')" class="${cardStyle} rounded-xl border shadow-sm hover:shadow-md transition flex flex-col h-full group overflow-hidden cursor-pointer ${pinnedClass}">${pinnedBadge}${currentBoardType!=='free' ? imgHtml : ''}<div class="p-5 flex-grow flex flex-col"><h3 class="font-bold text-slate-800 text-lg mb-2 line-clamp-2 group-hover:text-blue-600 transition">${safeTitle}</h3><div class="mt-auto pt-3 border-t border-slate-50 flex flex-col"><div class="flex justify-between text-xs text-slate-500"><span>${escapeHtml(post.author)}${authorBadge} ${ipTag}</span><span>${post.date}</span></div><div class="flex gap-3 text-xs text-slate-400 mt-2"><span class="flex items-center"><i class="fa-regular fa-eye mr-1"></i> ${post.views||0}</span><span class="flex items-center"><i class="fa-regular fa-comments mr-1"></i> ${cmtCount}</span></div></div></div></div>`;
        } else {
            html = `<div onclick="window.readPost('${post.id}')" class="flex items-center p-4 ${cardStyle} border rounded-xl shadow-sm hover:border-blue-400 transition cursor-pointer group ${pinnedClass}">${pinnedBadge}<div class="mr-4 w-10 text-center text-xl text-slate-400"><i class="fa-solid ${currentBoardType==='notice'?'fa-bullhorn text-blue-500':'fa-file-lines'}"></i></div><div class="flex-grow min-w-0"><div class="flex items-center gap-2 mb-1"><h3 class="font-bold text-slate-800 truncate group-hover:text-blue-600 transition">${safeTitle}</h3>${displayImg?'<i class="fa-regular fa-image text-slate-400 text-xs"></i>':''}</div><div class="flex items-center gap-4"><div class="text-xs text-slate-500 flex gap-2"><span>${escapeHtml(post.author)}${authorBadge} ${ipTag}</span><span>${post.date}</span></div><div class="flex gap-3 text-xs text-slate-400"><span class="flex items-center"><i class="fa-regular fa-eye mr-1"></i> ${post.views||0}</span><span class="flex items-center"><i class="fa-regular fa-comments mr-1"></i> ${cmtCount}</span></div></div></div></div>`;
        }
        container.innerHTML += html;
    });
}

export function renderPagination(containerId, totalCount, pageSize, currentPage, onPageChange) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = '';
    const totalPages = Math.ceil(totalCount / pageSize);
    
    if (totalPages <= 1) return;

    const maxButtons = 5;
    const startPage = Math.floor((currentPage - 1) / maxButtons) * maxButtons + 1;
    const endPage = Math.min(startPage + maxButtons - 1, totalPages);

    const prevBtn = document.createElement('button');
    prevBtn.className = "pagination-btn";
    prevBtn.disabled = currentPage === 1;
    prevBtn.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
    prevBtn.onclick = () => onPageChange(currentPage - 1);
    container.appendChild(prevBtn);

    for (let i = startPage; i <= endPage; i++) {
        const btn = document.createElement('button');
        btn.className = `pagination-btn ${i === currentPage ? 'active' : ''}`;
        btn.innerText = i;
        btn.onclick = () => onPageChange(i);
        container.appendChild(btn);
    }

    const nextBtn = document.createElement('button');
    nextBtn.className = "pagination-btn";
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
    nextBtn.onclick = () => onPageChange(currentPage + 1);
    container.appendChild(nextBtn);
}

export function renderPostDetail(post, isAdmin) {
    document.title = `하포카 해결소 | ${post.title}`;

    const titleEl = document.getElementById('detail-title');
    if(titleEl) titleEl.innerText = post.title || '제목 없음';
    
    let authorHtml = escapeHtml(post.author);
    if(post.author === '하포카' || post.author === 'Admin') {
        authorHtml += ` <span class="admin-badge-icon"><i class="fa-solid fa-circle-check"></i></span>`;
    }
    const authorEl = document.getElementById('detail-author');
    if(authorEl) authorEl.innerHTML = authorHtml;

    const dateEl = document.getElementById('detail-date');
    if(dateEl) dateEl.innerText = post.date;
    
    const viewsEl = document.getElementById('detail-views');
    if(viewsEl) viewsEl.innerText = post.views || 0;
    
    const contentDiv = document.getElementById('detail-content');
    if(contentDiv) {
        let safeContent = post.content || ''; 
        safeContent = preprocessMarkdown(safeContent);
        let parsed = marked.parse(safeContent);
        contentDiv.innerHTML = sanitizeContent(parsed);
        
        contentDiv.querySelectorAll('img').forEach(img => {
            if (!img.classList.contains('youtube-thumbnail')) {
                img.onclick = () => openLightbox(img.src);
                img.classList.add('cursor-zoom-in');
            } else {
                img.style.cursor = 'pointer'; 
            }
        });
    }

    const badge = document.getElementById('detail-badge');
    if(badge) {
        let catName = "기타";
        let catClass = "bg-gray-100 text-gray-600";
        if (post.type === 'notice') { catName = "공지"; catClass = "bg-blue-100 text-blue-600"; }
        else if (post.type === 'free') { catName = "자유"; catClass = "bg-slate-100 text-slate-600"; }
        else if (post.type === 'error') { catName = "오류질문"; catClass = "bg-red-100 text-red-600"; }
        badge.innerText = catName;
        badge.className = `text-xs px-2 py-1 rounded font-bold ${catClass}`;
    }

    const adminControls = document.getElementById('admin-controls');
    if(adminControls) {
        if(isAdmin) {
            adminControls.classList.remove('hidden');
            const pinBtn = document.getElementById('btn-pin-post');
            if(pinBtn) {
                pinBtn.innerHTML = post.is_pinned ? '<i class="fa-solid fa-thumbtack"></i> 고정 해제' : '<i class="fa-solid fa-thumbtack"></i> 상단 고정';
                pinBtn.classList.toggle('text-blue-600', post.is_pinned);
            }
            
            const catSelect = document.getElementById('move-category-select');
            if(catSelect) {
                catSelect.innerHTML = '<option value="">카테고리 이동</option>';
                const categories = { 'notice': '공지사항', 'free': '자유대화방', 'error': '오류해결소' };
                for(const [key, label] of Object.entries(categories)) {
                    if(key !== post.type) {
                        const opt = document.createElement('option');
                        opt.value = key;
                        opt.innerText = label;
                        catSelect.appendChild(opt);
                    }
                }
            }
        } else {
            adminControls.classList.add('hidden');
        }
    }
}

function buildCommentTree(comments) {
    const map = {};
    const roots = [];
    
    comments.forEach((c, index) => {
        const match = c.content.match(/<!-- parent_id:(.*?) -->/);
        const parentId = match ? match[1] : null;
        
        map[c.id] = { ...c, children: [], _originalIndex: index }; 
        map[c.id].displayContent = c.content.replace(/<!-- parent_id:.*? -->/g, '');
        
        if (parentId) {
            map[c.id].parentId = parentId;
        }
    });

    comments.forEach(c => {
        const node = map[c.id];
        if (node.parentId && map[node.parentId]) {
            map[node.parentId].children.push(node);
        } else {
            roots.push(node);
        }
    });

    const sortNodes = (nodes) => {
        nodes.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        nodes.forEach(node => {
            if (node.children.length > 0) sortNodes(node.children);
        });
    };
    sortNodes(roots);
    
    return roots;
}

function renderCommentNode(node, depth, listElement, isAdmin) {
    const safeDepth = Math.min(depth, 3);
    
    let authorBadge = '';
    if(node.author === '하포카' || node.author === 'Admin') authorBadge = `<span class="admin-badge-icon"><i class="fa-solid fa-circle-check"></i></span>`;

    let wrapperClass = safeDepth > 0 ? `reply-item reply-depth-${safeDepth}` : "bg-white p-4 rounded-xl border border-slate-100";
    let indicator = safeDepth > 0 ? `<i class="fa-solid fa-turn-up fa-rotate-90 reply-indicator"></i>` : "";

    if (node.reports >= 5) {
        if (safeDepth > 0) {
            wrapperClass = wrapperClass.replace(/bg-slate-\d+/g, 'bg-red-50');
            wrapperClass += " border-red-200 ring-1 ring-red-100";
        } else {
            wrapperClass = "bg-red-50 p-4 rounded-xl border border-red-200 ring-1 ring-red-100";
        }
    }

    let ipTag = '';
    if(isAdmin) {
        let rawIp = node.ip || 'Unknown';
        ipTag = `<span class="text-red-300 text-[10px] ml-1">(${rawIp})</span>`;
    }

    const html = `
        <div class="flex gap-3 group mb-3 ${wrapperClass}">
            ${indicator}
            <div class="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold text-xs flex-shrink-0 select-none">${node.author.charAt(0)}</div>
            <div class="flex-grow min-w-0">
                <div class="flex items-baseline gap-2 justify-between">
                    <div class="flex items-baseline gap-2">
                        <span class="font-bold text-slate-700 text-sm">${escapeHtml(node.author)}${authorBadge}</span>
                        ${ipTag}
                        <span class="text-xs text-slate-400">${new Date(node.created_at).toLocaleString()}</span>
                    </div>
                    <div class="flex gap-2 opacity-0 group-hover:opacity-100 transition">
                        <button onclick="window.replyToComment('${node.id}', '${node.author}')" class="text-slate-400 hover:text-blue-600 text-xs font-bold mr-2"><i class="fa-solid fa-reply"></i> 답글</button>
                        <button onclick="window.reportComment('${node.id}')" class="text-slate-400 hover:text-red-500 text-xs font-bold mr-2"><i class="fa-solid fa-land-mine-on"></i> 신고</button>
                        <button onclick="window.requestPasswordCheck('${node.id}', 'edit_comment')" class="text-slate-400 hover:text-blue-600 text-xs"><i class="fa-solid fa-pen"></i></button>
                        <button onclick="window.requestPasswordCheck('${node.id}', 'delete_comment')" class="text-slate-400 hover:text-red-600 text-xs"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
                <div class="text-slate-600 text-sm mt-1 whitespace-pre-wrap break-all">${node.displayContent}</div>
            </div>
        </div>
    `;
    
    const div = document.createElement('div');
    div.innerHTML = html;
    listElement.appendChild(div);

    if (node.children && node.children.length > 0) {
        node.children.forEach(child => renderCommentNode(child, depth + 1, listElement, isAdmin));
    }
}

export function renderComments(cmts, containerId, isAdmin) {
    const list = document.getElementById(containerId);
    if(!list) return;
    list.innerHTML = '';
    
    const countEl = document.getElementById('detail-comments-count');
    if(countEl) countEl.innerText = cmts.length;
    
    if (cmts.length === 0) { 
        list.innerHTML = '<p class="text-slate-400 text-center py-4">아직 댓글이 없습니다.</p>'; 
        return; 
    }

    const rootNodes = buildCommentTree(cmts);
    rootNodes.forEach(node => renderCommentNode(node, 0, list, isAdmin));
    
    document.querySelectorAll(`#${containerId} img`).forEach(img => {
        img.onclick = () => openLightbox(img.src);
    });
}

export function openLightbox(src) {
    const lightbox = document.getElementById('lightbox');
    const img = document.getElementById('lightbox-img');
    img.src = src;
    lightbox.classList.remove('hidden');
    lightbox.classList.add('flex');
}

export function closeLightbox() {
    const lightbox = document.getElementById('lightbox');
    lightbox.classList.remove('flex');
    lightbox.classList.add('hidden');
}

export function updateAdminUI(isAdmin, loadSavedNickname) { 
    const b = document.getElementById('navAdminBadge'); 
    const mb = document.getElementById('mobileAdminBadge'); 
    const d = document.getElementById('btn-admin-dash'); 
    const dm = document.getElementById('btn-admin-dash-m'); 
    const show = isAdmin ? 'remove' : 'add'; 
    if(b) b.classList[show]('hidden'); 
    if(mb) mb.classList[show]('hidden'); 
    if(d) d.classList[show]('hidden'); 
    if(dm) dm.classList[show]('hidden'); 
    
    const cmtName = document.getElementById('cmtName');
    const cmtPw = document.getElementById('cmtPw');
    if(cmtName && cmtPw) {
        if(isAdmin) {
            cmtName.value = "하포카"; cmtName.disabled = true;
            cmtPw.value = ""; cmtPw.classList.add('hidden');
        } else {
            cmtName.value = loadSavedNickname ? loadSavedNickname() : ''; 
            cmtName.disabled = false;
            if(!window.editingCommentId) cmtPw.classList.remove('hidden');
        }
    }
}
