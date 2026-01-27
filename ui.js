window.PAGE_TITLES = {
    'home': '하포카 해결소',
    'notice': '공지사항',
    'free': '자유대화방',
    'list': '오류해결소',
    'write': '글쓰기',
    'detail': '게시글',
    'admin': '관리자',
    'search': '검색 결과',
    'test': '테스트 게시판'
};

window.ENABLE_SNOW = true;
window.particlesConfig = {
    "particles": {
        "number": { "value": 100 },
        "size": { "value": 3 },
        "move": { "speed": 1, "direction": "bottom" },
        "line_linked": { "enable": false },
        "opacity": { "value": 0.7 }
    }
};

window.router = function(page, isAdmin) {
    if (page === 'error') page = 'list';

    document.title = window.PAGE_TITLES[page] || '하포카 해결소';

    var sections = document.querySelectorAll('.view-section');
    for (var i = 0; i < sections.length; i++) {
        sections[i].classList.add('hidden');
    }
    
    var footer = document.getElementById('main-footer');
    if(page === 'write') {
        if(footer) footer.classList.add('hidden');
    } else {
        if(footer) footer.classList.remove('hidden');
    }

    if(['notice','free','list','test'].includes(page)) {
        document.getElementById('view-board').classList.remove('hidden');
    } else {
        var target = document.getElementById('view-' + page);
        if(target) target.classList.remove('hidden');
    }

    window.scrollTo(0, 0);

    var snowContainer = document.getElementById('snow-container');
    if (snowContainer) {
        if (page === 'home' && window.ENABLE_SNOW) {
            snowContainer.style.display = 'block';
            snowContainer.style.zIndex = '1';
            snowContainer.style.pointerEvents = 'none';
            
            if (typeof particlesJS !== 'undefined' && !window.isSnowInitialized) {
                particlesJS('snow-container', window.particlesConfig);
                window.isSnowInitialized = true;
            }
        } else {
            snowContainer.style.display = 'none';
        }
    }

    if (page === 'write' && typeof window.loadTempPost === 'function') {
        window.loadTempPost();
    }
};

window.showAlert = function(msg, title) {
    if (!title) title = "알림";
    document.getElementById('alertTitle').innerText = title;
    document.getElementById('alertMessage').innerText = msg;
    document.getElementById('alertModal').classList.remove('hidden');
    setTimeout(function() { document.getElementById('alertOkBtn').focus(); }, 50);
};

window.showContentModal = function(htmlContent, title) {
    if (!title) title = "내용 확인";
    document.getElementById('alertTitle').innerText = title;
    document.getElementById('alertMessage').innerHTML = htmlContent; 
    document.getElementById('alertModal').classList.remove('hidden');
};

window.closeAlert = function() {
    document.getElementById('alertModal').classList.add('hidden');
    document.getElementById('alertMessage').innerText = "";
    
    if(!document.getElementById('passwordModal').classList.contains('hidden')) {
        document.getElementById('verificationPw').focus();
    }
};

window.showConfirm = function(msg, callback, title, btnText) {
    if (!title) title = "확인";
    if (!btnText) btnText = "삭제";
    document.getElementById('confirmTitle').innerText = title;
    document.getElementById('confirmMessage').innerText = msg;
    
    var yesBtn = document.getElementById('btn-confirm-yes');
    yesBtn.innerText = btnText;
    
    var newBtn = yesBtn.cloneNode(true);
    yesBtn.parentNode.replaceChild(newBtn, yesBtn);
    
    newBtn.onclick = function() {
        window.closeConfirm();
        callback();
    };
    
    document.getElementById('confirmModal').classList.remove('hidden');
    
    var isAdminView = false;
    var adminView = document.getElementById('view-admin');
    if (adminView && !adminView.classList.contains('hidden')) {
        isAdminView = true;
    }

    if (!isAdminView) {
        setTimeout(function() { newBtn.focus(); }, 50);
    } else {
        setTimeout(function() { newBtn.previousElementSibling.focus(); }, 50);
    }
};

window.closeConfirm = function() {
    document.getElementById('confirmModal').classList.add('hidden');
    window.confirmCallback = null;
};

window.confirmMove = function(targetPage) {
    var currentView = document.querySelector('.view-section:not(.hidden)').id;
    
    if (currentView === 'view-write') {
        var title = document.getElementById('inputTitle').value;
        var html = document.getElementById('editorContentHtml').innerText.trim();
        var md = document.getElementById('editorContentMarkdown').value.trim();
        
        if (title || html || md) {
            window.showConfirm(
                '작성 중인 내용이 있습니다.\n정말 이동하시겠습니까?\n(내용은 임시 저장됩니다)', 
                function() { 
                    window.processNavigation(targetPage); 
                },
                "작성 취소",
                "이동"
            );
            return;
        }
    }
    window.processNavigation(targetPage);
};

window.processNavigation = function(target) {
    if (target === 'home') {
        window.router('home');
    } else if (['notice', 'free', 'list', 'test'].includes(target)) {
        if (typeof currentBoardType !== 'undefined') currentBoardType = target;
        window.router('board'); 
        if (typeof renderBoard === 'function') renderBoard();
    } else if (target === 'admin') {
        if (typeof isAdminLoggedIn === 'function' && isAdminLoggedIn()) {
            window.router('admin');
            if (typeof renderAdminDashboard === 'function') renderAdminDashboard();
        } else {
            window.openAdminLogin();
        }
    } else {
        window.router(target);
    }
};

window.toggleMobileMenu = function() {
    document.getElementById('mobile-menu').classList.toggle('hidden');
};

window.openCategoryModal = function() {
    document.getElementById('categoryModal').classList.remove('hidden');
};

window.closeCategoryModal = function() {
    document.getElementById('categoryModal').classList.add('hidden');
};

window.openAdminLogin = function() {
    document.getElementById('adminModal').classList.remove('hidden');
    setTimeout(function(){ document.getElementById('adminEmail').focus(); }, 100);
};

window.closeAdminLogin = window.closeAdminModal = function() {
    document.getElementById('adminModal').classList.add('hidden');
};

window.openPasswordModal = function(callback) {
    var modal = document.getElementById('passwordModal');
    var input = document.getElementById('verificationPw');
    input.value = '';
    modal.classList.remove('hidden');
    input.focus();
    window.currentPasswordCallback = callback;
};

window.closePasswordModal = function() {
    document.getElementById('passwordModal').classList.add('hidden');
    window.currentPasswordCallback = null;
};

window.confirmPasswordAction = function() {
    var pw = document.getElementById('verificationPw').value;
    if (!pw) {
        window.showAlert('비밀번호를 입력해주세요.', '알림');
        return;
    }
    if (window.currentPasswordCallback) {
        window.currentPasswordCallback(pw);
    }
    window.closePasswordModal();
};

window.toggleSearchDropdown = function(type) {
    document.getElementById('menu-search-type-' + type).classList.toggle('hidden');
};

window.selectSearchType = function(value, text) {
    document.getElementById('searchTypeSelect').value = value;
    document.getElementById('txt-search-type-desktop').innerText = text;
    document.getElementById('mobileSearchTypeSelect').value = value;
    document.getElementById('txt-search-type-mobile').innerText = text;
    document.getElementById('menu-search-type-desktop').classList.add('hidden');
    document.getElementById('menu-search-type-mobile').classList.add('hidden');
};

window.toggleVersionDropdown = function() {
    document.getElementById('menu-version-select').classList.toggle('hidden');
};

window.selectVersion = function(value, text) {
    document.getElementById('selectedGameVersion').value = value;
    document.getElementById('txt-version-select').innerText = text;
    document.getElementById('menu-version-select').classList.add('hidden');
};

window.showGlobalLoader = function(show) {
    var loader = document.getElementById('global-loader');
    if (show) loader.classList.remove('hidden');
    else loader.classList.add('hidden');
};

window.toggleViewMode = function(mode) {
    var container = document.getElementById('board-container');
    var btnGrid = document.getElementById('btn-grid');
    var btnList = document.getElementById('btn-list');
    
    if (!container || !btnGrid || !btnList) return;

    if (mode === 'grid') {
        container.classList.remove('flex', 'flex-col', 'space-y-2');
        container.classList.add('grid', 'gap-6');
        btnGrid.classList.add('bg-slate-100', 'text-slate-800');
        btnGrid.classList.remove('text-slate-400');
        btnGrid.classList.add('dark:bg-slate-800', 'dark:text-slate-200');
        
        btnList.classList.remove('bg-slate-100', 'text-slate-800', 'dark:bg-slate-800', 'dark:text-slate-200');
        btnList.classList.add('text-slate-400');
    } else {
        container.classList.remove('grid', 'gap-6');
        container.classList.add('flex', 'flex-col', 'space-y-2');
        btnList.classList.add('bg-slate-100', 'text-slate-800');
        btnList.classList.remove('text-slate-400');
        btnList.classList.add('dark:bg-slate-800', 'dark:text-slate-200');
        
        btnGrid.classList.remove('bg-slate-100', 'text-slate-800', 'dark:bg-slate-800', 'dark:text-slate-200');
        btnGrid.classList.add('text-slate-400');
    }
};

window.switchAdminTab = function(tabId) {
    var contents = document.querySelectorAll('.admin-tab-content');
    for(var i=0; i<contents.length; i++) contents[i].classList.add('hidden');
    
    var content = document.getElementById('admin-view-' + tabId);
    if (content) content.classList.remove('hidden');

    var tabs = ['dashboard', 'reported', 'deleted-posts', 'deleted-comments', 'ip-search'];
    tabs.forEach(function(t) {
        var btn = document.getElementById('tab-admin-' + t);
        if (btn) {
            if (t === tabId) {
                btn.className = "px-4 py-2 font-bold text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-blue-50/50 dark:bg-blue-900/20 rounded-t-lg transition whitespace-nowrap";
            } else {
                btn.className = "px-4 py-2 font-bold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 border-b-2 border-transparent hover:border-slate-300 dark:hover:border-slate-700 transition whitespace-nowrap";
            }
        }
    });

    if (tabId === 'dashboard' && typeof renderAdminDashboard === 'function') renderAdminDashboard();
    else if (tabId === 'reported' && typeof renderReportedItems === 'function') renderReportedItems();
    else if (tabId === 'deleted-posts' && typeof renderDeletedPosts === 'function') renderDeletedPosts(1);
    else if (tabId === 'deleted-comments' && typeof renderDeletedComments === 'function') renderDeletedComments(1);
};

window.toggleSelectAll = function(type, isChecked) {
    var checkboxes = document.querySelectorAll('.chk-' + type);
    for(var i=0; i<checkboxes.length; i++) {
        checkboxes[i].checked = isChecked;
    }
};

window.goDownload = function() {
    window.open('https://github.com/Pretsg/Archeage_auto/releases', '_blank');
};

window.renderPostList = function(postsData, containerId, viewMode, currentBoardType, isAdmin) {
    var container = document.getElementById(containerId);
    container.innerHTML = '';
    
    if(postsData.length === 0) { 
        container.innerHTML = '<div class="col-span-full text-center py-20 text-slate-400 dark:text-slate-500">게시글이 없습니다.</div>'; 
        return; 
    }

    if(currentBoardType === 'error') {
        if(viewMode === 'grid') container.className = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6";
        else container.className = "flex flex-col gap-3";
    } else if(currentBoardType === 'free' || currentBoardType === 'test') {
        container.className = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6";
    } else {
        container.className = "flex flex-col gap-3";
    }

    postsData.forEach(function(post) {
        var safeTitle = typeof escapeHtml === 'function' ? escapeHtml(post.title) : post.title;
        var authorBadge = '';
        if(post.author === '하포카' || post.author === 'Admin') {
            authorBadge = '<span class="admin-badge-icon"><i class="fa-solid fa-circle-check"></i></span>';
        }

        var ipTag = '';
        if(isAdmin) {
            var rawIp = post.ip || 'Unknown';
            ipTag = '<span class="ml-2 text-[10px] text-red-400 font-bold font-mono" title="' + rawIp + '">(' + rawIp + ')</span>';
        }

        var cmtCount = post.comments ? post.comments.length : 0;
        var displayImg = post.image_url || post.image;
        
        var cardStyle = "bg-white dark:bg-black border border-slate-200 dark:border-slate-800";
        var titleColor = "text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400";
        var pinnedBadge = "";
        
        if (post.reports >= 5) {
            cardStyle = "bg-red-50 dark:bg-red-900/10 border-red-300 dark:border-red-800 ring-2 ring-red-200 dark:ring-red-900/30";
        } else if (post.is_pinned) {
            cardStyle = "bg-blue-50 dark:bg-black border-2 border-blue-400 dark:border-blue-500 shadow-md dark:shadow-blue-500/10 relative";
            titleColor = "text-blue-700 dark:text-blue-400"; 
            pinnedBadge = '<div class="absolute top-3 right-3 text-blue-500 dark:text-blue-400 text-lg z-10"><i class="fa-solid fa-thumbtack"></i></div>';
        }

        var versionBadge = '';
        if (post.game_version) {
            var vClass = 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700';
            var vText = post.game_version;
            
            if (vText === '1.2') {
                vClass = 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800';
                vText = '1.2';
            } else if (vText === '5.0') {
                vClass = 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800';
                vText = '5.0';
            } else if (vText === 'common') {
                vClass = 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800';
                vText = '공통';
            }
            
            versionBadge = '<span class="inline-block text-[11px] px-2 py-0.5 rounded border font-bold mr-1.5 align-middle ' + vClass + '">' + vText + '</span>';
        }

        var html = '';
        if(container.className.includes('grid')) {
            var imgHtml = displayImg ? 
                '<div class="h-40 bg-slate-100 dark:bg-slate-900 overflow-hidden group relative"><img src="' + displayImg + '" class="w-full h-full object-cover transition duration-500 group-hover:scale-105"></div>' : 
                '<div class="h-40 bg-slate-50 dark:bg-slate-900 flex items-center justify-center text-slate-300 dark:text-slate-700 text-3xl"></div>';
                
            if (currentBoardType === 'free' || currentBoardType === 'test') imgHtml = ''; 

            html = '<div onclick="readPost(\'' + post.id + '\')" class="' + cardStyle + ' rounded-xl shadow-sm hover:shadow-md transition flex flex-col h-full group overflow-hidden cursor-pointer">' + pinnedBadge + (currentBoardType!=='free' && currentBoardType!=='test' ? imgHtml : '') + '<div class="p-5 flex-grow flex flex-col"><div class="mb-1">' + versionBadge + '</div><h3 class="font-bold text-lg mb-2 line-clamp-2 transition ' + titleColor + '">' + safeTitle + '</h3><div class="mt-auto pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col"><div class="flex justify-between text-xs text-slate-500 dark:text-slate-400"><span>' + (typeof escapeHtml === 'function' ? escapeHtml(post.author) : post.author) + authorBadge + ' ' + ipTag + '</span><span>' + post.date + '</span></div><div class="flex gap-3 text-xs text-slate-400 dark:text-slate-500 mt-2"><span class="flex items-center"><i class="fa-regular fa-eye mr-1"></i> ' + (post.views||0) + '</span><span class="flex items-center"><i class="fa-regular fa-comments mr-1"></i> ' + cmtCount + '</span></div></div></div></div>';
        } else {
            var iconClass = currentBoardType==='notice' ? 'fa-bullhorn text-blue-500' : 'fa-file-lines';
            html = '<div onclick="readPost(\'' + post.id + '\')" class="flex items-center p-4 ' + cardStyle + ' rounded-xl shadow-sm hover:border-blue-400 dark:hover:border-blue-500 transition cursor-pointer group">' + pinnedBadge + '<div class="mr-4 w-10 text-center text-xl text-slate-400 dark:text-slate-500"><i class="fa-solid ' + iconClass + '"></i></div><div class="flex-grow min-w-0"><div class="flex items-center gap-2 mb-1">' + versionBadge + '<h3 class="font-bold truncate transition ' + titleColor + '">' + safeTitle + '</h3>' + (displayImg?'<i class="fa-regular fa-image text-slate-400 text-xs"></i>':'') + '</div><div class="flex items-center gap-4"><div class="text-xs text-slate-500 dark:text-slate-400 flex gap-2"><span>' + (typeof escapeHtml === 'function' ? escapeHtml(post.author) : post.author) + authorBadge + ' ' + ipTag + '</span><span>' + post.date + '</span></div><div class="flex gap-3 text-xs text-slate-400 dark:text-slate-500"><span class="flex items-center"><i class="fa-regular fa-eye mr-1"></i> ' + (post.views||0) + '</span><span class="flex items-center"><i class="fa-regular fa-comments mr-1"></i> ' + cmtCount + '</span></div></div></div></div>';
        }
        container.innerHTML += html;
    });
};

window.renderPagination = function(containerId, totalCount, pageSize, currentPage, onPageChange) {
    var container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = '';
    var totalPages = Math.ceil(totalCount / pageSize);
    
    if (totalPages <= 1) return;

    var maxButtons = 5;
    var startPage = Math.floor((currentPage - 1) / maxButtons) * maxButtons + 1;
    var endPage = Math.min(startPage + maxButtons - 1, totalPages);

    var prevBtn = document.createElement('button');
    prevBtn.className = "pagination-btn dark:bg-black dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-900";
    prevBtn.disabled = currentPage === 1;
    prevBtn.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
    prevBtn.onclick = function() { onPageChange(currentPage - 1); };
    container.appendChild(prevBtn);

    for (var i = startPage; i <= endPage; i++) {
        (function(pageIndex) {
            var btn = document.createElement('button');
            var activeClass = pageIndex === currentPage ? 'active' : 'dark:bg-black dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-900';
            btn.className = "pagination-btn " + activeClass;
            btn.innerText = pageIndex;
            btn.onclick = function() { onPageChange(pageIndex); };
            container.appendChild(btn);
        })(i);
    }

    var nextBtn = document.createElement('button');
    nextBtn.className = "pagination-btn dark:bg-black dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-900";
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
    nextBtn.onclick = function() { onPageChange(currentPage + 1); };
    container.appendChild(nextBtn);
};

window.renderPostDetail = function(post, isAdmin) {
    document.title = '하포카 해결소 | ' + post.title;

    var versionBadge = '';
    if (post.game_version) {
        var vClass = 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700';
        var vText = post.game_version;
        
        if (vText === '1.2') {
            vClass = 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800';
            vText = '1.2';
        } else if (vText === '5.0') {
            vClass = 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800';
            vText = '5.0';
        } else if (vText === 'common') {
            vClass = 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800';
            vText = '공통';
        }
        versionBadge = '<span class="inline-block text-sm px-2 py-1 rounded border font-bold mr-2 align-middle ' + vClass + '">' + vText + '</span>';
    }

    var titleEl = document.getElementById('detail-title');
    if(titleEl) {
        var safeTitle = typeof escapeHtml === 'function' ? escapeHtml(post.title) : post.title;
        titleEl.innerHTML = versionBadge + safeTitle;
    }
    
    var authorHtml = typeof escapeHtml === 'function' ? escapeHtml(post.author) : post.author;
    if(post.author === '하포카' || post.author === 'Admin') {
        authorHtml += ' <span class="admin-badge-icon"><i class="fa-solid fa-circle-check"></i></span>';
    }
    var authorEl = document.getElementById('detail-author');
    if(authorEl) authorEl.innerHTML = authorHtml;

    var dateEl = document.getElementById('detail-date');
    if(dateEl) dateEl.innerText = post.date;
    
    var viewsEl = document.getElementById('detail-views');
    if(viewsEl) viewsEl.innerText = post.views || 0;
    
    var contentDiv = document.getElementById('detail-content');
    if(contentDiv) {
        var safeContent = post.content || ''; 
        safeContent = safeContent.replace(/<!-- version:.*? -->/g, ''); 

        if(typeof preprocessMarkdown === 'function') safeContent = preprocessMarkdown(safeContent);
        
        var parsed = marked.parse(safeContent);
        if(typeof sanitizeContent === 'function') contentDiv.innerHTML = sanitizeContent(parsed);
        else contentDiv.innerHTML = parsed;
        
        var imgs = contentDiv.querySelectorAll('img');
        for(var i=0; i<imgs.length; i++) {
            var img = imgs[i];
            if (!img.classList.contains('youtube-thumbnail')) {
                img.onclick = function() { window.openLightbox(this.src); };
                img.classList.add('cursor-zoom-in');
            } else {
                img.style.cursor = 'pointer'; 
            }
        }

        var links = contentDiv.querySelectorAll('a');
        for (var i = 0; i < links.length; i++) {
            var link = links[i];
            var href = link.getAttribute('href');
            if (href && !href.startsWith('javascript:') && !link.onclick) {
                link.onclick = function(e) {
                    e.preventDefault();
                    window.confirmLink(this.href);
                };
            }
        }
    }

    var badge = document.getElementById('detail-badge');
    if(badge) {
        var catName = "기타";
        var catClass = "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400";
        if (post.type === 'notice') { catName = "공지"; catClass = "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"; }
        else if (post.type === 'free') { catName = "자유"; catClass = "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"; }
        else if (post.type === 'error') { catName = "오류질문"; catClass = "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"; }
        else if (post.type === 'test') { catName = "테스트"; catClass = "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400"; }
        badge.innerText = catName;
        badge.className = "text-xs px-2 py-1 rounded font-bold " + catClass;
    }

    var adminControls = document.getElementById('admin-controls');
    if(adminControls) {
        if(isAdmin) {
            adminControls.classList.remove('hidden');
            var pinBtn = document.getElementById('btn-pin-post');
            if(pinBtn) {
                pinBtn.innerHTML = post.is_pinned ? '<i class="fa-solid fa-thumbtack"></i> 고정 해제' : '<i class="fa-solid fa-thumbtack"></i> 상단 고정';
                if(post.is_pinned) pinBtn.classList.add('text-blue-600', 'dark:text-blue-400');
                else pinBtn.classList.remove('text-blue-600', 'dark:text-blue-400');
            }
            
            var catSelect = document.getElementById('move-category-select');
            if(catSelect) {
                catSelect.innerHTML = '<option value="">카테고리 이동</option>';
                var categories = { 'free': '자유대화방', 'error': '오류해결소' };
                for(var key in categories) {
                    var isCurrent = (key === post.type) || (key === 'error' && post.type === 'list');
                    if(!isCurrent) {
                        var opt = document.createElement('option');
                        opt.value = key;
                        opt.innerText = categories[key];
                        catSelect.appendChild(opt);
                    }
                }
                
                catSelect.onchange = function() {
                    if (typeof window.changePostCategory === 'function') {
                        window.changePostCategory(this, post.id);
                    }
                };
            }
        } else {
            adminControls.classList.add('hidden');
        }
    }
};

window.buildCommentTree = function(comments) {
    var map = {};
    var roots = [];
    
    comments.forEach(function(c, index) {
        var match = c.content.match(/<!-- parent_id:(.*?) -->/);
        var parentId = match ? match[1] : null;
        
        map[c.id] = Object.assign({}, c, { children: [], _originalIndex: index });
        map[c.id].displayContent = c.content.replace(/<!-- parent_id:.*? -->/g, '');
        
        if (parentId) {
            map[c.id].parentId = parentId;
        }
    });

    comments.forEach(function(c) {
        var node = map[c.id];
        if (node.parentId && map[node.parentId]) {
            map[node.parentId].children.push(node);
        } else {
            roots.push(node);
        }
    });

    var sortNodes = function(nodes) {
        nodes.sort(function(a, b) { return new Date(a.created_at) - new Date(b.created_at); });
        nodes.forEach(function(node) {
            if (node.children.length > 0) sortNodes(node.children);
        });
    };
    sortNodes(roots);
    
    return roots;
};

window.toggleCommentContent = function(btn) {
    var container = btn.parentElement;
    var shortDiv = container.querySelector('.comment-content-short');
    var fullDiv = container.querySelector('.comment-content-full');

    if (shortDiv.classList.contains('hidden')) {
        shortDiv.classList.remove('hidden');
        fullDiv.classList.add('hidden');
        btn.innerText = '...더보기';
    } else {
        shortDiv.classList.add('hidden');
        fullDiv.classList.remove('hidden');
        btn.innerText = '접기';
    }
};

window.renderCommentNode = function(node, depth, listElement, isAdmin, parentAuthor) {
    var displayDepth = Math.min(depth, 1);
    
    var authorBadge = '';
    if(node.author === '하포카' || node.author === 'Admin') authorBadge = '<span class="admin-badge-icon"><i class="fa-solid fa-circle-check"></i></span>';

    var wrapperClass = displayDepth > 0 ? ('reply-item reply-depth-' + displayDepth) : "bg-white dark:bg-black p-4 rounded-xl border border-slate-100 dark:border-slate-800";
    var indicator = displayDepth > 0 ? '<i class="fa-solid fa-turn-up fa-rotate-90 reply-indicator"></i>' : "";

    if (node.reports >= 5) {
        if (displayDepth > 0) {
            wrapperClass = wrapperClass.replace(/bg-slate-\d+/g, 'bg-red-50 dark:bg-red-900/10');
            wrapperClass += " border-red-200 dark:border-red-800 ring-1 ring-red-100 dark:ring-red-900/30";
        } else {
            wrapperClass = "bg-red-50 dark:bg-red-900/10 p-4 rounded-xl border border-red-200 dark:border-red-800 ring-1 ring-red-100 dark:ring-red-900/30";
        }
    }

    var ipTag = '';
    if(isAdmin) {
        var rawIp = node.ip || 'Unknown';
        ipTag = '<span class="text-red-300 text-[10px] ml-1">(' + rawIp + ')</span>';
    }

    var content = node.displayContent;
    
    if (depth >= 2 && parentAuthor) {
        content = '<span class="text-blue-600 dark:text-blue-400 font-bold bg-blue-50 dark:bg-blue-900/30 px-1 rounded mr-1 text-xs">@' + parentAuthor + '</span> ' + content;
    }

    var textOnly = content.replace(/<[^>]*>/g, '').trim(); 
    var isLongContent = textOnly.length > 300; 
    var shortContent = textOnly.substring(0, 300) + '...';
    
    var contentHtml = '';
    if (isLongContent) {
        contentHtml = 
            '<div class="comment-content-short text-slate-600 dark:text-slate-300 text-sm mt-1 whitespace-pre-wrap break-all">' + shortContent + '</div>' +
            '<div class="comment-content-full hidden text-slate-600 dark:text-slate-300 text-sm mt-1 whitespace-pre-wrap break-all">' + content + '</div>' +
            '<button class="text-blue-500 dark:text-blue-400 text-xs font-bold mt-1 hover:underline btn-more-content" onclick="window.toggleCommentContent(this)">...더보기</button>';
    } else {
        contentHtml = '<div class="text-slate-600 dark:text-slate-300 text-sm mt-1 whitespace-pre-wrap break-all">' + content + '</div>';
    }

    var html = 
        '<div class="flex gap-3 group mb-3 ' + wrapperClass + '">' +
            indicator +
            '<div class="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 font-bold text-xs flex-shrink-0 select-none">' + node.author.charAt(0) + '</div>' +
            '<div class="flex-grow min-w-0">' +
                '<div class="flex items-baseline gap-2 justify-between">' +
                    '<div class="flex items-baseline gap-2">' +
                        '<span class="font-bold text-slate-700 dark:text-slate-200 text-sm">' + (typeof escapeHtml === 'function' ? escapeHtml(node.author) : node.author) + authorBadge + '</span>' +
                        ipTag +
                        '<span class="text-xs text-slate-400 dark:text-slate-500">' + new Date(node.created_at).toLocaleString() + '</span>' +
                    '</div>' +
                    '<div class="flex gap-2 opacity-0 group-hover:opacity-100 transition">' +
                        '<button onclick="replyToComment(\'' + node.id + '\', \'' + node.author + '\')" class="text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 text-xs font-bold mr-2"><i class="fa-solid fa-reply"></i> 답글</button>' +
                        '<button onclick="reportComment(\'' + node.id + '\')" class="text-slate-400 hover:text-red-500 text-xs font-bold mr-2"><i class="fa-solid fa-land-mine-on"></i> 신고</button>' +
                        '<button onclick="requestPasswordCheck(\'' + node.id + '\', \'edit_comment\')" class="text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 text-xs"><i class="fa-solid fa-pen"></i></button>' +
                        '<button onclick="requestPasswordCheck(\'' + node.id + '\', \'delete_comment\')" class="text-slate-400 hover:text-red-600 text-xs"><i class="fa-solid fa-trash"></i></button>' +
                    '</div>' +
                '</div>' +
                contentHtml + 
            '</div>' +
        '</div>';
    
    var div = document.createElement('div');
    div.innerHTML = html;
    listElement.appendChild(div);

    if (node.children && node.children.length > 0) {
        node.children.forEach(function(child) {
            window.renderCommentNode(child, depth + 1, listElement, isAdmin, node.author);
        });
    }
};

window.renderComments = function(cmts, containerId, isAdmin) {
    var list = document.getElementById(containerId);
    if(!list) return;
    list.innerHTML = '';
    
    var countEl = document.getElementById('detail-comments-count');
    if(countEl) countEl.innerText = cmts.length;
    
    if (cmts.length === 0) { 
        list.innerHTML = '<p class="text-slate-400 dark:text-slate-500 text-center py-4">아직 댓글이 없습니다.</p>'; 
        return; 
    }

    var rootNodes = window.buildCommentTree(cmts);
    rootNodes.forEach(function(node) {
        window.renderCommentNode(node, 0, list, isAdmin);
    });
    
    var imgs = document.querySelectorAll('#' + containerId + ' img');
    for(var i=0; i<imgs.length; i++) {
        imgs[i].onclick = function() { window.openLightbox(this.src); };
    }
};

window.openLightbox = function(src) {
    var lightbox = document.getElementById('lightbox');
    var img = document.getElementById('lightbox-img');
    img.src = src;
    lightbox.classList.remove('hidden');
    lightbox.classList.add('flex');
};

window.closeLightbox = function() {
    var lightbox = document.getElementById('lightbox');
    lightbox.classList.remove('flex');
    lightbox.classList.add('hidden');
};

window.confirmLink = function(url) {
    window.showConfirm('외부 사이트로 이동합니다.\n\n링크: ' + url + '\n\n정말 연결하시겠습니까?', function() {
        window.open(url, '_blank');
    }, "외부 링크 연결 확인", "이동");
};

window.updateAdminUI = function(isAdmin, loadSavedNicknameFn) { 
    var b = document.getElementById('navAdminBadge'); 
    var mb = document.getElementById('mobileAdminBadge'); 
    var d = document.getElementById('btn-admin-dash'); 
    var dm = document.getElementById('btn-admin-dash-m'); 
    var show = isAdmin ? 'remove' : 'add'; 
    if(b) b.classList[show]('hidden'); 
    if(mb) mb.classList[show]('hidden'); 
    if(d) d.classList[show]('hidden'); 
    if(dm) dm.classList[show]('hidden'); 
    
    var cmtName = document.getElementById('cmtName');
    var cmtPw = document.getElementById('cmtPw');
    if(cmtName && cmtPw) {
        if(isAdmin) {
            cmtName.value = "하포카"; cmtName.disabled = true;
            cmtPw.value = ""; cmtPw.classList.add('hidden');
        } else {
            cmtName.value = (loadSavedNicknameFn ? loadSavedNicknameFn() : ''); 
            cmtName.disabled = false;
            if(typeof editingCommentId !== 'undefined' && !editingCommentId) cmtPw.classList.remove('hidden');
        }
    }
};

document.addEventListener('keydown', function(e) {
    var confirmModal = document.getElementById('confirmModal');
    if (confirmModal && !confirmModal.classList.contains('hidden')) {
        if (e.key === 'Escape') {
            window.closeConfirm();
            e.preventDefault();
            e.stopPropagation();
        } else if (e.key === 'Enter') {
            var isAdminView = false;
            var adminView = document.getElementById('view-admin');
            if (adminView && !adminView.classList.contains('hidden')) isAdminView = true;
            
            if (!isAdminView) {
                e.preventDefault();
                e.stopPropagation();
                var yesBtn = document.getElementById('btn-confirm-yes');
                if (yesBtn) yesBtn.click();
            }
        } else if (e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
        }
    }

    var alertModal = document.getElementById('alertModal');
    if (alertModal && !alertModal.classList.contains('hidden') && e.key === 'Escape') {
        window.closeAlert();
        e.preventDefault();
    }

    var pwModal = document.getElementById('passwordModal');
    if (pwModal && !pwModal.classList.contains('hidden') && e.key === 'Escape') {
        window.closePasswordModal();
        e.preventDefault();
    }
});

document.addEventListener('click', (e) => {
    if (!e.target.closest('#btn-version-select')) {
        const menu = document.getElementById('menu-version-select');
        if (menu && !menu.classList.contains('hidden')) {
            menu.classList.add('hidden');
        }
    }
});

window.renderTopNotification = async function() {
    if (typeof TOP_NOTICE === 'undefined' || !TOP_NOTICE.enabled) return;

    var noticeText = null;
    if (typeof fetchTopNotice === 'function') {
        noticeText = await fetchTopNotice();
    }
    
    if (!noticeText) return;

    var noticeDiv = document.createElement('div');
    noticeDiv.id = 'top-notice-bar';
    noticeDiv.className = 'fixed top-0 left-0 w-full z-[100] flex justify-center items-center px-4 py-2 text-sm font-bold shadow-sm transition-transform duration-300';
    
    var container = document.createElement('div');
    container.className = 'flex items-center justify-center text-center';
    container.innerHTML = '<i class="fa-solid fa-bullhorn mr-2"></i><span>' + noticeText + '</span>';
    
    var closeBtn = document.createElement('button');
    closeBtn.className = 'ml-4 opacity-70 hover:opacity-100 transition flex-shrink-0';
    closeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
    
    noticeDiv.appendChild(container);
    noticeDiv.appendChild(closeBtn);

    document.body.prepend(noticeDiv);

    var h = noticeDiv.offsetHeight;
    document.body.style.paddingTop = h + 'px';
    var nav = document.querySelector('nav');
    if(nav) {
        nav.style.top = h + 'px';
        nav.style.transition = 'top 0.3s';
    }
    
    closeBtn.onclick = function() {
        noticeDiv.style.transform = 'translateY(-100%)';
        document.body.style.paddingTop = '0';
        if(nav) nav.style.top = '0';
        setTimeout(function() { noticeDiv.remove(); }, 300);
    };
};

document.addEventListener('DOMContentLoaded', function() {
    window.renderTopNotification();
});
