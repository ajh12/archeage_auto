var pendingActionType = null; 
var pendingTarget = null;
var pendingTargetId = null;

if (!window.hasMainJsRun) {
    window.hasMainJsRun = true;
    window.currentEditorMode = 'html'; 
    window.isWriting = false; 

    const uiRouter = (typeof window.router === 'function') ? window.router : null;
    const originalSwitchEditorTab = (typeof window.switchEditorTab === 'function') ? window.switchEditorTab : null;

    document.addEventListener('DOMContentLoaded', () => {
        window.addEventListener('beforeunload', (e) => {
            if (window.isWriting) {
                e.preventDefault();
                e.returnValue = ''; 
            }
        });

        if(typeof configureMarked === 'function') configureMarked();
        
        if(typeof setupPasteHandlers === 'function') {
            setupPasteHandlers(
                (file) => processPostImage(file, currentEditorMode),
                (files) => processCommentImages(files, currentCommentImages, renderCommentImagePreview)
            );
        }
        
        document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
        const loader = document.getElementById('global-loader');
        if(loader) loader.classList.remove('hidden');

        document.addEventListener('click', (e) => {
            if (!e.target.closest('#btn-search-type-desktop') && !e.target.closest('#btn-search-type-mobile')) {
                 document.querySelectorAll('[id^="menu-search-type-"]').forEach(el => el.classList.add('hidden'));
            }
            if (!e.target.closest('#btn-font-size')) {
                const menu = document.getElementById('menu-font-size');
                if(menu && !menu.classList.contains('hidden')) {
                    menu.classList.add('hidden');
                }
            }
        });

        if(typeof initSupabase === 'function') {
            initSupabase((event, session) => {
                if (session) {
                    isAdmin = true;
                    if(typeof updateAdminUI === 'function') updateAdminUI(isAdmin, loadSavedNickname);
                    if(typeof updateAdminStats === 'function') updateAdminStats();
                } else {
                    isAdmin = false;
                    if(typeof updateAdminUI === 'function') updateAdminUI(isAdmin, loadSavedNickname);
                }
            });
        }

        if(typeof fetchClientIP === 'function') fetchClientIP();
        if(typeof fetchVersion === 'function') {
            fetchVersion().then(v => {
                const vText = document.getElementById('version-text');
                if(v && vText) vText.innerText = "최신버전  " + v;
            });
        }

        const lbImg = document.getElementById('lightbox-img');
        if(lbImg) {
            lbImg.style.cursor = 'zoom-in';
            lbImg.style.transition = 'transform 0.3s ease';
            let isZoomed = false;
            
            lbImg.onclick = (e) => {
                e.stopPropagation();
                isZoomed = !isZoomed;
                if(isZoomed) {
                    lbImg.style.transform = 'scale(2)';
                    lbImg.style.cursor = 'zoom-out';
                } else {
                    lbImg.style.transform = 'scale(1)';
                    lbImg.style.cursor = 'zoom-in';
                }
            };

            const originalClose = window.closeLightbox;
            window.closeLightbox = function() {
                lbImg.style.transform = 'scale(1)';
                isZoomed = false;
                lbImg.style.cursor = 'zoom-in';
                if(originalClose) originalClose();
                else {
                    const lb = document.getElementById('lightbox');
                    if(lb) {
                        lb.classList.add('hidden');
                        lb.classList.remove('flex');
                    }
                }
            }
        }
    });

    window.onload = () => { 
        const loader = document.getElementById('global-loader');
        if(loader) loader.classList.remove('hidden');

        if(typeof loadLocalPostsData === 'function') loadLocalPostsData(); 
        
        const initialHash = window.location.hash.replace('#', '');
        const realPage = (typeof getPageFromCode === 'function') ? getPageFromCode(initialHash) : 'home'; 
        
        if (realPage === 'detail') { 
            const savedId = localStorage.getItem('aa_current_post_id');
            if (savedId) {
                readPost(savedId).then(() => {
                    if(loader) setTimeout(() => loader.classList.add('hidden'), 300);
                }).catch(() => {
                    window.router('home', false);
                    if(loader) setTimeout(() => loader.classList.add('hidden'), 300);
                });
            } else {
                window.router('home', false);
                if(loader) setTimeout(() => loader.classList.add('hidden'), 300);
            }
        } else {
            window.router(realPage, false);
            if(loader) setTimeout(() => loader.classList.add('hidden'), 300);
        }
        
        if(typeof recordVisit === 'function') recordVisit(); 
    };

    window.addEventListener('popstate', (event) => {
        if (window.isWriting) {
            history.pushState({ page: 'write' }, null, '#' + (ROUTE_MAP['write'] || 'write'));
            
            let msg = editingPostId ? "수정사항이 저장되지 않으며,\n원래 내용으로 유지됩니다." : "작성 중인 내용이 삭제됩니다.\n이동하시겠습니까?";
            let btn = editingPostId ? "이동" : "삭제 후 이동";

            showConfirm(msg, () => {
                resetEditor();
                window.isWriting = false; 
                const targetPage = lastPage || 'home';
                window.router(targetPage); 
            }, "페이지 이동", btn);
            return;
        }

        if (event.state && event.state.page) {
            window.router(event.state.page, false);
        } else {
            window.router('home', false);
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace') {
            const tag = e.target.tagName;
            const isEditable = e.target.isContentEditable;
            if (tag !== 'INPUT' && tag !== 'TEXTAREA' && !isEditable) {
                e.preventDefault();
                window.confirmNavigation('back');
            }
        }
    });

    window.router = function(page, pushHistory = true) {
        if(pushHistory) {
            const code = (typeof ROUTE_MAP !== 'undefined' && ROUTE_MAP[page]) ? ROUTE_MAP[page] : page;
            history.pushState({ page }, null, page === 'home' ? ' ' : `#${code}`);
        }
        
        if (uiRouter && typeof uiRouter === 'function') {
            uiRouter(page, isAdmin);
        }
        
        if (page !== 'write' && page !== 'detail') {
            lastPage = page;
        }
        
        window.isWriting = (page === 'write');
        
        if (page === 'admin' && typeof switchAdminTab === 'function' && typeof currentAdminTab !== 'undefined') {
            switchAdminTab(currentAdminTab);
        }
        
        if(['notice', 'free', 'list', 'error'].includes(page)) {
            const boardInput = document.getElementById('boardSearchInput');
            if(boardInput) boardInput.value = '';

            fetchPosts(page === 'list' ? 'error' : page, 1);
        }
    };

    window.confirmNavigation = (targetPage) => {
        if (targetPage === 'back') {
            targetPage = lastPage;
            if(targetPage === 'admin') {
                window.router('admin');
                return;
            }
        }

        if (window.isWriting) {
            let content = "";
            if (currentEditorMode === 'html') {
                const el = document.getElementById('editorContentHtml');
                if(el) content = el.innerText.trim();
            } else {
                const el = document.getElementById('editorContentMarkdown');
                if(el) content = el.value.trim();
            }
            
            const titleInput = document.getElementById('inputTitle');
            const title = titleInput ? titleInput.value : "";
            
            if (title.length > 0 || content.length > 0) {
                let msg = "";
                let btnText = "";
                if(editingPostId) {
                    msg = "수정사항이 저장되지 않으며,\n원래 내용으로 유지됩니다.";
                    btnText = "이동";
                } else {
                    msg = "작성 중인 내용이 삭제됩니다.\n이동하시겠습니까?";
                    btnText = "삭제 후 이동";
                }

                showConfirm(msg, () => {
                    resetEditor();
                    window.router(targetPage);
                }, "페이지 이동", btnText);
                return;
            }
            resetEditor();
        } 
        else if (editingCommentId || (document.getElementById('cmtContent') && document.getElementById('cmtContent').value.trim().length > 0)) {
            let msg = editingCommentId ? "수정 중인 댓글이 초기화됩니다.\n이동하시겠습니까?" : "작성 중인 댓글이 삭제됩니다.\n이동하시겠습니까?";
            
            showConfirm(msg, () => {
                cancelCommentEdit();
                window.router(targetPage);
            }, "페이지 이동", "이동");
            return;
        }

        window.router(targetPage);
    };

    window.toggleMobileMenu = () => {
        const menu = document.getElementById('mobile-menu');
        if(menu) menu.classList.toggle('hidden');
    };

    window.openCategoryModal = () => {
        const modal = document.getElementById('categoryModal');
        if(modal) {
            modal.classList.remove('hidden');
            const noticeBtn = document.getElementById('btn-write-notice');
            if(noticeBtn) noticeBtn.classList.toggle('hidden', !isAdmin);
        }
    };

    window.closeCategoryModal = () => {
        const modal = document.getElementById('categoryModal');
        if(modal) modal.classList.add('hidden');
    };

    window.writePost = (type) => {
        document.getElementById('categoryModal').classList.add('hidden');

        if (editingPostId) {
            showConfirm("현재 수정 중인 글이 있습니다.\n글쓰기로 이동하면 수정 내용은 저장되지 않습니다.\n새로운 글을 쓰시겠습니까?", () => {
                _proceedWritePost(type);
            }, "글쓰기 전환", "이동");
            return;
        }

        _proceedWritePost(type);
    };

    function _proceedWritePost(type) {
        localStorage.removeItem('tempPost'); 
        editingPostId = null;
        currentBoardType = type;

        const header = document.getElementById('write-header');
        if(header) header.innerText = type === 'notice' ? "📢 공지사항 작성" : (type === 'free' ? "💬 자유대화방 글쓰기" : "🛠️ 오류 질문 작성");
        
        document.getElementById('inputTitle').value=''; 
        const nameInput = document.getElementById('inputName');
        nameInput.value = loadSavedNickname();
        nameInput.disabled = false;
        
        const pwInput = document.getElementById('inputPw');
        pwInput.value = '';
        pwInput.disabled = false;
        
        const pwContainer = document.getElementById('pw-container');
        if(pwContainer) pwContainer.classList.remove('hidden');

        if(isAdmin) {
            nameInput.value = "하포카";
            nameInput.disabled = true;
            pwContainer.classList.add('hidden');
        }

        const editorHtml = document.getElementById('editorContentHtml');
        if(editorHtml) editorHtml.innerHTML='';
        const editorMd = document.getElementById('editorContentMarkdown');
        if(editorMd) editorMd.value='';
        const mdPreview = document.getElementById('markdown-preview');
        if(mdPreview) mdPreview.innerHTML='';

        window.switchEditorTab('html');
        window.router('write');
    }

    window.searchBoard = function() {
        fetchPosts(currentBoardType, 1);
    };

    window.readPost = readPost;
    window.changePage = (p) => fetchPosts(currentBoardType, p);
    window.toggleViewMode = (mode) => { errorViewMode = mode; renderBoard(); };
    window.goDownload = () => window.open('https://github.com/Pretsg/Archeage_auto/releases', '_blank');

    window.toggleSearchDropdown = (type) => {
        const id = `menu-search-type-${type}`;
        const menu = document.getElementById(id);
        if (menu) menu.classList.toggle('hidden');
        
        ['desktop', 'mobile'].forEach(t => {
            if(t !== type) {
                const other = document.getElementById(`menu-search-type-${t}`);
                if(other) other.classList.add('hidden');
            }
        });
    };

    window.selectSearchType = (val, label) => {
        const s1 = document.getElementById('searchTypeSelect');
        const s2 = document.getElementById('mobileSearchTypeSelect');
        if(s1) s1.value = val;
        if(s2) s2.value = val;
        
        const t1 = document.getElementById('txt-search-type-desktop');
        const t2 = document.getElementById('txt-search-type-mobile');
        if(t1) t1.innerText = label;
        if(t2) t2.innerText = label;
        
        document.querySelectorAll('[id^="menu-search-type-"]').forEach(el => el.classList.add('hidden'));
    };

    window.searchGlobal = (val) => {
        let keyword = val;
        if(!keyword) {
            const input1 = document.getElementById('globalSearchInput');
            const input2 = document.getElementById('mobileSearchInput');
            keyword = (input1 ? input1.value.trim() : '') || (input2 ? input2.value.trim() : '');
        }
        
        if(!keyword || keyword.length < 2) return showAlert("검색어는 2글자 이상 입력해주세요.");

        const mBtn = document.getElementById('btn-search-type-mobile');
        let searchType = 'all';
        if(mBtn && window.getComputedStyle(mBtn).display !== 'none' && mBtn.offsetParent !== null) {
            searchType = document.getElementById('mobileSearchTypeSelect').value;
        } else {
            searchType = document.getElementById('searchTypeSelect').value;
        }

        const i1 = document.getElementById('globalSearchInput');
        const i2 = document.getElementById('mobileSearchInput');
        if(i1) i1.value = keyword;
        if(i2) i2.value = keyword;

        performSearch(keyword, searchType);
    };

    window.execCmd = (command, value) => {
        if(typeof execCmd === 'function' && execCmd !== window.execCmd) {
            execCmd(command, value);
        } else {
            document.execCommand(command, false, value);
            const editor = document.getElementById('editorContentHtml');
            if(editor) editor.focus();
        }
    };

    window.switchEditorTab = (tab) => {
        if (originalSwitchEditorTab && typeof originalSwitchEditorTab === 'function') {
            originalSwitchEditorTab(tab);
        } else {
            currentEditorMode = tab;
        }
    };

    window.insertImage = (inp) => { if(inp.files[0]) processPostImage(inp.files[0], currentEditorMode); inp.value=''; };
    
    window.toggleFontSizeDropdown = () => {
        const menu = document.getElementById('menu-font-size');
        if(menu) menu.classList.toggle('hidden');
    };
    
    window.applyFontSize = (size, label) => {
        window.execCmd('fontSize', size);
        const txt = document.getElementById('txt-font-size');
        if(txt) txt.innerText = label;
        document.getElementById('menu-font-size').classList.add('hidden');
    };

    window.submitPost = submitPost;
    window.submitComment = submitComment;
    window.requestPasswordCheck = requestPasswordCheck;
    window.confirmPasswordAction = confirmPasswordAction;
    window.closePasswordModal = () => document.getElementById('passwordModal').classList.add('hidden');
    window.closeConfirm = closeConfirm;
    window.closeAlert = closeAlert;

    window.replyToComment = (id, author) => {
        replyingToCommentId = id;
        document.getElementById('reply-target-msg').innerText = author;
        document.getElementById('reply-target-box').classList.remove('hidden');
        document.getElementById('cmtContent').focus();
        document.getElementById('cmt-drop-zone').scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    window.reportCurrentPost = reportCurrentPost;
    window.reportComment = async (id) => {
        const dbClient = getDbClient();
        if(!dbClient) return showAlert("오프라인 불가");
        
        showConfirm("신고하시겠습니까?", async () => {
            if (isAdmin) {
                try {
                    const { data: cmt } = await dbClient.from('comments').select('reports').eq('id', id).single();
                    if (cmt) {
                        const newCount = (cmt.reports || 0) + 1;
                        const { error } = await dbClient.from('comments').update({ reports: newCount }).eq('id', id);
                        if (error) throw error;
                        showAlert("관리자 권한으로 신고 처리되었습니다.");
                        
                        const post = posts.find(p => p.id == currentPostId);
                        if(post && post.comments) {
                            const target = post.comments.find(c => c.id == id);
                            if(target) target.reports = newCount;
                            renderComments(post.comments, 'comment-list', isAdmin);
                        }
                    }
                } catch(e) {
                    showAlert("처리 실패: " + e.message);
                }
            } else {
                const { error } = await dbClient.rpc('report_content_secure', { p_type: 'comment', p_id: id });
                if(error) showAlert(error.message); 
                else {
                    showAlert("신고 접수됨");
                    const post = posts.find(p => p.id == currentPostId);
                    if(post && post.comments) {
                        const target = post.comments.find(c => c.id == id);
                        if(target) target.reports = (target.reports || 0) + 1;
                        renderComments(post.comments, 'comment-list', isAdmin);
                    }
                }
            }
        }, "신고", "신고");
    };

    window.removeCommentImage = (idx) => {
        currentCommentImages.splice(idx, 1);
        renderCommentImagePreview();
    };

    window.cancelCommentEdit = cancelCommentEdit;
    window.cancelReply = cancelReply;
    window.uploadCommentImage = (input) => {
        if(input.files && input.files.length > 0) {
            processCommentImages(input.files, currentCommentImages, renderCommentImagePreview);
            input.value = '';
        }
    };

    window.openAdminLogin = () => { if(!isAdmin) document.getElementById('adminModal').classList.remove('hidden'); };
    window.closeAdminModal = () => document.getElementById('adminModal').classList.add('hidden');

    window.tryAdminLogin = async () => {
        const e = document.getElementById('adminEmail').value;
        const p = document.getElementById('adminPw').value;
        const dbClient = getDbClient();
        if(dbClient) {
            const { data, error } = await dbClient.auth.signInWithPassword({ email: e, password: p });
            if(error) showAlert('로그인 실패: ' + error.message);
            else { 
                document.getElementById('adminModal').classList.add('hidden'); 
                showAlert("로그인 성공"); 
                document.getElementById('adminEmail').value = '';
                document.getElementById('adminPw').value = '';
            }
        } else {
            showAlert('DB 연결 오류');
        }
    };

    window.adminLogout = () => {
        showConfirm('로그아웃 하시겠습니까?', async () => { 
            const dbClient = getDbClient();
            if(dbClient) await dbClient.auth.signOut();
            isAdmin = false;
            updateAdminUI(isAdmin, loadSavedNickname);
            window.router('home');
            showAlert("로그아웃 되었습니다.");
        }, "로그아웃", "로그아웃");
    };

    window.switchAdminTab = switchAdminTab;
    window.toggleSelectAll = toggleSelectAll;
    window.restorePost = restorePost;
    window.permanentlyDeletePost = permanentlyDeletePost;
    window.restoreComment = restoreComment;
    window.permanentlyDeleteComment = permanentlyDeleteComment;
    window.adminSearchByIp = adminSearchByIp;
    window.clearReports = clearReports;
    window.removeBan = removeBan;
    window.addBan = addBan;
    window.deleteSelected = (type) => {
        showAlert("기능 준비 중입니다."); 
    };

    window.togglePinPost = togglePinPost;
    window.movePostCategory = movePostCategory;
    window.deletePost = deletePost;

    window.openLightbox = openLightbox;
    window.closeLightbox = closeLightbox;

    window.confirmLink = (url) => {
        showConfirm(`외부 사이트로 이동합니다.\n\n링크: ${url}\n\n정말 연결하시겠습니까?`, () => {
            window.open(url, '_blank');
        }, "외부 링크 연결 확인", "이동");
    };

    function loadLocalPostsData() { 
        posts = loadLocalPosts(); 
    }

    async function fetchPosts(type, page = 1) {
        const dbClient = getDbClient();
        if (!dbClient) {
            loadLocalPostsData();
            renderBoard();
            return;
        }
        
        currentBoardType = type;
        currentPage = page;
        
        const spinner = document.getElementById('loading-spinner');
        if(spinner) spinner.classList.remove('hidden');
        
        const keyword = document.getElementById('boardSearchInput').value.trim();
        
        let query = dbClient.from('posts').select('*, comments(*)', { count: 'exact' }).eq('type', type).is('deleted_at', null).order('is_pinned', { ascending: false }).order('created_at', { ascending: false });

        if (keyword) {
            query = query.or(`title.ilike.%${keyword}%,author.ilike.%${keyword}%`);
        }

        const from = (page - 1) * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        const { data, count, error } = await query.range(from, to);

        if (error) { 
            console.error("DB Fetch Error:", error); 
            if(posts.length === 0) loadLocalPostsData();
            renderBoard();
        } else {
            totalCount = count || 0;
            posts = data.map(p => ({
                ...p,
                date: new Date(p.created_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
                comments: (p.comments || []).filter(c => !c.deleted_at),
                reports: p.reports || 0,
                reported_by: Array.isArray(p.reported_by) ? p.reported_by : [] 
            }));
            saveLocalPosts(posts);
            renderBoard();
            renderPagination('pagination-container', totalCount, PAGE_SIZE, currentPage, (p) => fetchPosts(currentBoardType, p)); 
        }
        if(isAdmin) updateAdminStats();
        if(spinner) spinner.classList.add('hidden');
    }

    function renderBoard() {
        const container = document.getElementById('board-container');
        if(!container) return;

        const titles = { notice: {t:'📢 공지사항', d:'중요 업데이트 및 안내'}, free: {t:'💬 자유대화방', d:'자유로운 소통 공간'}, error: {t:'🛠️ 오류해결소', d:'오류 질문 및 해결법 공유'} };
        
        const tEl = document.getElementById('board-title');
        const dEl = document.getElementById('board-desc');
        if(tEl && titles[currentBoardType]) tEl.innerText = titles[currentBoardType].t;
        if(dEl && titles[currentBoardType]) dEl.innerText = titles[currentBoardType].d;
        
        const toggles = document.getElementById('view-toggles');
        if(toggles) toggles.classList.toggle('hidden', currentBoardType !== 'error');
        
        const writeBtn = document.getElementById('btn-write-board');
        if(writeBtn) writeBtn.classList.toggle('hidden', currentBoardType === 'notice' && !isAdmin);

        if (currentBoardType === 'error') {
            const gBtn = document.getElementById('btn-grid');
            const lBtn = document.getElementById('btn-list');
            if(gBtn) gBtn.classList.toggle('view-btn-active', errorViewMode === 'grid');
            if(lBtn) lBtn.classList.toggle('view-btn-active', errorViewMode === 'list');
        }

        renderPostList(posts, 'board-container', errorViewMode, currentBoardType, isAdmin);
    }

    async function readPost(id, directData = null) {
        const dbClient = getDbClient();
        localStorage.setItem('aa_current_post_id', id);
        const viewedKey = `viewed_post_${id}_${getClientIP() || 'unknown'}`;
        
        if(dbClient && !localStorage.getItem(viewedKey)) {
            try {
                const { error } = await dbClient.rpc('increment_views', { row_id: id });
                if(!error) {
                    const targetPost = posts.find(p => p.id == id);
                    if (targetPost) {
                        targetPost.views = (targetPost.views || 0) + 1; 
                        dbClient.from('posts').update({ views: targetPost.views }).eq('id', id);
                    }
                    localStorage.setItem(viewedKey, 'true'); 
                }
            } catch (e) {}
        }
        
        let post = directData || posts.find(p => p.id == id);

        if (!post && dbClient) {
            try {
                const { data, dataError } = await dbClient.from('posts').select('*, comments(*)').eq('id', id).single();
                if (data) {
                    post = {
                        ...data,
                        date: new Date(data.created_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
                        comments: (data.comments || []).filter(c => !c.deleted_at),
                        reported_by: Array.isArray(data.reported_by) ? data.reported_by : []
                    };
                }
            } catch (e) {}
        }

        if (!post) return window.router('list');
        
        currentPostId = id;
        renderPostDetail(post, isAdmin);
        
        const btnDelete = document.getElementById('btn-force-delete');
        const btnEdit = document.getElementById('btn-edit-post');
        if(btnDelete) {
            btnDelete.classList.remove('hidden');
            btnDelete.onclick = () => requestPasswordCheck(id, 'delete_post');
        }
        if(btnEdit) {
            btnEdit.classList.remove('hidden');
            btnEdit.onclick = () => requestPasswordCheck(id, 'edit_post');
        }

        const commentWriteArea = document.getElementById('comment-write-area');
        if(commentWriteArea) {
            commentWriteArea.classList.toggle('hidden', post.type === 'notice');
        }

        cancelReply();
        renderComments(post.comments || [], 'comment-list', isAdmin);
        window.router('detail');
    }

    async function performSearch(keyword, searchType) {
        document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
        document.getElementById('view-search').classList.remove('hidden');
        window.scrollTo(0,0);
        
        if(lastPage !== 'search') history.pushState({ page: 'search' }, null, `#${ROUTE_MAP['search'] || 'search'}`);
        lastPage = 'search'; 

        const kDisplay = document.querySelector('#search-keyword-display span');
        if(kDisplay) kDisplay.innerText = keyword;
        
        const container = document.getElementById('search-results-container');
        container.innerHTML = '';
        document.getElementById('loading-spinner').classList.remove('hidden');

        const dbClient = getDbClient();
        let queryResults = [];

        if(dbClient) {
            let query = dbClient.from('posts').select('*').is('deleted_at', null).order('created_at', {ascending: false});
            if (searchType === 'nickname') {
                query = query.ilike('author', `%${keyword}%`);
            } else {
                query = query.or(`title.ilike.%${keyword}%,content.ilike.%${keyword}%`);
            }
            const { data, error } = await query;
            if(!error && data) queryResults = data;
        } else {
            if (searchType === 'nickname') {
                queryResults = posts.filter(p => p.author.toLowerCase().includes(keyword.toLowerCase()) && !p.deleted_at);
            } else {
                queryResults = posts.filter(p => (p.title.toLowerCase().includes(keyword.toLowerCase()) || p.content.toLowerCase().includes(keyword.toLowerCase())) && !p.deleted_at);
            }
        }
        
        renderSearchResults(queryResults, keyword);
        document.getElementById('loading-spinner').classList.add('hidden');
    }

    function renderSearchResults(results, keyword) {
        const container = document.getElementById('search-results-container');
        const noResult = document.getElementById('search-no-result');
        
        if(results.length === 0) {
            noResult.classList.remove('hidden');
            return;
        }
        noResult.classList.add('hidden');

        const typeMap = {'free':'자유', 'error':'오류', 'notice':'공지'};
        const typeColor = {'free':'bg-slate-100 text-slate-600', 'error':'bg-red-100 text-red-600', 'notice':'bg-blue-100 text-blue-600'};

        results.forEach(post => {
            let highlightedTitle = escapeHtml(post.title);
            const searchType = document.getElementById('searchTypeSelect').value === 'nickname' ? 'nickname' : 'all';
            
            if (searchType !== 'nickname') {
                const regex = new RegExp(`(${keyword})`, 'gi');
                highlightedTitle = escapeHtml(post.title).replace(regex, '<span class="search-highlight">$1</span>');
            }
            
            let snippet = "";
            const div = document.createElement('div');
            div.innerHTML = marked.parse(post.content); 
            let textContent = div.textContent || div.innerText || "";
            
            snippet = textContent.substring(0, 100) + "...";
            
            if (searchType !== 'nickname') {
                const idx = textContent.toLowerCase().indexOf(keyword.toLowerCase());
                if(idx > -1) {
                    const start = Math.max(0, idx - 20);
                    const end = Math.min(textContent.length, idx + 40);
                    snippet = (start>0?"...":"") + textContent.substring(start, end) + (end<textContent.length?"...":"");
                }
            }
            
            const badgeHtml = `<span class="text-[10px] px-2 py-0.5 rounded font-bold ${typeColor[post.type] || 'bg-gray-100'}">${typeMap[post.type] || '기타'}</span>`;

            container.innerHTML += `<div onclick="readPost('${post.id}')" class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-400 transition cursor-pointer"><div class="flex items-center gap-2 mb-2">${badgeHtml}<span class="text-xs text-slate-400">${new Date(post.created_at).toLocaleDateString()}</span></div><h3 class="font-bold text-lg text-slate-800 mb-2 truncate">${highlightedTitle}</h3><p class="text-sm text-slate-500 mb-3 break-all">${escapeHtml(snippet)}</p><div class="flex items-center gap-2 text-xs text-slate-400"><span>${escapeHtml(post.author)}</span><span class="mx-1">|</span><i class="fa-regular fa-eye mr-1"></i> ${post.views||0}</div></div>`;
        });
    }

    async function submitPost() {
        const dbClient = getDbClient();
        const t = document.getElementById('inputTitle').value.trim(); 
        let n = document.getElementById('inputName').value.trim(); 
        let pw = document.getElementById('inputPw').value.trim(); 
        
        let finalContent = "";
        let textCheck = "";

        if (currentEditorMode === 'html') {
            finalContent = document.getElementById('editorContentHtml').innerHTML;
            const hasMedia = /<(img|iframe|video|embed|object)/i.test(finalContent);
            const textOnly = document.getElementById('editorContentHtml').innerText.replace(/\s/g, '');
            if (!textOnly && !hasMedia) textCheck = ""; 
            else textCheck = "ok";
        } else {
            finalContent = document.getElementById('editorContentMarkdown').value;
            textCheck = finalContent.trim();
        }
        
        let thumb = null;
        const imgMatch = finalContent.match(/<img[^>]+src=["']([^"']+)["']/);
        const mdImgMatch = finalContent.match(/!\[.*?\]\((.*?)\)/);
        
        if (imgMatch && imgMatch[1]) thumb = imgMatch[1];
        else if (mdImgMatch && mdImgMatch[1]) thumb = mdImgMatch[1];

        if(!t) return showAlert('제목을 입력하세요.'); 
        if(!textCheck && !thumb) return showAlert('내용을 입력하세요.');

        if (!isAdmin && typeof grecaptcha !== 'undefined' && RECAPTCHA_SITE_KEY) {
            try {
                const token = await new Promise((resolve) => {
                    grecaptcha.ready(() => {
                        grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: 'submit_post' })
                            .then(token => resolve(token))
                            .catch(err => { console.error(err); resolve(null); });
                    });
                });

                if (!token) return showAlert("캡차 토큰 생성에 실패했습니다. 새로고침 후 다시 시도해주세요.");
                
                const isVerified = await verifyCaptcha(token);
                if (!isVerified) {
                    return showAlert(
                        "보안 검증(봇 탐지)에 실패했습니다.\n\n" +
                        "1. 현재 '시크릿 모드'를 사용 중이라면 해제해주세요.\n" +
                        "2. VPN이나 광고 차단 확장 프로그램을 끄고 시도해주세요.\n\n" +
                        "(Google reCAPTCHA 점수 미달)"
                    );
                }
                
            } catch (e) {
                console.error("Captcha error:", e);
                return showAlert("캡차 인증 중 시스템 오류가 발생했습니다.");
            }
        }

        if(isAdmin) { n = "하포카"; pw = ""; } 
        else {
            const banned = ['admin', '하포카', '관리자', '관리인'];
            if(banned.includes(n.toLowerCase())) return showAlert("사용할 수 없는 닉네임입니다.");
            if(!editingPostId && !/^[a-zA-Z0-9]{4,10}$/.test(pw)) return showAlert('비밀번호는 영문+숫자 4~10자여야 합니다.');
            if(!n) n = '익명';
        }

        let postData = { title: t, content: finalContent, image: thumb };
        if(!editingPostId) {
            postData.author = n;
            postData.password = pw;
            postData.type = currentBoardType;
        }

        document.getElementById('global-loader').classList.remove('hidden');
        
        const isPinned = document.getElementById('checkPinned').checked;
        if(!isAdmin) saveNickname(postData.author);

        try {
            if (editingPostId) {
                if(!dbClient) return showAlert("오프라인 상태에서는 수정할 수 없습니다.");
                const { error } = await dbClient.rpc('update_post_secure', {
                    p_id: editingPostId,
                    p_title: postData.title,
                    p_content: postData.content,
                    p_image_url: postData.image,
                    p_is_pinned: isAdmin ? isPinned : false
                });
                if (error) throw error;
                showAlert("수정되었습니다.");
                window.isWriting = false; 
                
                const oldPost = posts.find(p => p.id == editingPostId) || {};
                const updatedPost = {
                    ...oldPost,
                    id: editingPostId,
                    title: postData.title,
                    content: postData.content,
                    image_url: postData.image,
                    image: postData.image,
                    is_pinned: isAdmin ? isPinned : (oldPost.is_pinned || false)
                };

                const idx = posts.findIndex(p => p.id == editingPostId);
                if (idx !== -1) {
                    posts[idx] = updatedPost;
                } else {
                    posts.unshift(updatedPost);
                }
                saveLocalPosts(posts);

                const targetId = editingPostId;
                resetEditor();
                localStorage.removeItem('tempPost');

                setTimeout(() => { 
                    readPost(targetId, updatedPost); 
                    document.getElementById('global-loader').classList.add('hidden'); 
                }, 100);
                return;
            }

            let finalPw = postData.password;
            if(!isAdmin && finalPw) finalPw = await sha256(finalPw);

            const { error } = await dbClient.rpc('create_post_secure', {
                p_title: postData.title,
                p_content: postData.content,
                p_author: postData.author,
                p_password: finalPw,
                p_type: postData.type,
                p_image_url: postData.image,
                p_is_pinned: isAdmin ? isPinned : false
            });
            if (error) throw error;
            
            showAlert('등록되었습니다.');
            window.isWriting = false; 
            resetEditor();

            localStorage.removeItem('tempPost');

            window.router(currentBoardType, isAdmin);
            document.getElementById('global-loader').classList.add('hidden'); 

        } catch (e) {
            document.getElementById('global-loader').classList.add('hidden'); 
            showAlert("오류: " + e.message);
        }
    }

    async function submitComment() {
        const dbClient = getDbClient();
        let name = document.getElementById('cmtName').value.trim();
        let contentText = document.getElementById('cmtContent').value; 
        let pw = document.getElementById('cmtPw').value.trim();

        if(!contentText.trim() && currentCommentImages.length === 0) return showAlert("내용을 입력하세요.");

        if (!isAdmin && typeof grecaptcha !== 'undefined' && RECAPTCHA_SITE_KEY) {
            try {
                const token = await new Promise((resolve) => {
                    grecaptcha.ready(() => {
                        grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: 'submit_comment' })
                            .then(token => resolve(token))
                            .catch(err => { console.error(err); resolve(null); });
                    });
                });

                if (!token) return showAlert("캡차 토큰 생성에 실패했습니다.");

                const isVerified = await verifyCaptcha(token);
                if (!isVerified) {
                    return showAlert(
                        "보안 검증(봇 탐지)에 실패했습니다.\n\n" +
                        "1. 현재 '시크릿 모드'를 사용 중이라면 해제해주세요.\n" +
                        "2. VPN이나 광고 차단 확장 프로그램을 끄고 시도해주세요.\n\n" +
                        "(Google reCAPTCHA 점수 미달)"
                    );
                }
            } catch (e) {
                console.error("Captcha error:", e);
                return showAlert("캡차 인증 중 오류가 발생했습니다.");
            }
        }

        if (isBanned) return showAlert("차단된 사용자는 댓글을 쓸 수 없습니다.");

        let imageHtml = '';
        if(currentCommentImages.length > 0) {
            imageHtml = '<div class="comment-img-container">';
            currentCommentImages.forEach(src => { imageHtml += `<img src="${src}" class="comment-img-thumb" onclick="openLightbox(this.src)">`; });
            imageHtml += '</div>';
        }
        
        let parentTag = replyingToCommentId ? `<!-- parent_id:${replyingToCommentId} -->` : '';
        let finalContent = contentText.replace(/\n/g, '<br>') + imageHtml + parentTag;

        if(!isAdmin) saveNickname(name);

        if(editingCommentId && dbClient) {
            const { error } = await dbClient.from('comments').update({ content: finalContent }).eq('id', editingCommentId);
            if(error) showAlert("수정 실패");
            else {
                const post = posts.find(p => p.id == currentPostId);
                const cmtIndex = post.comments.findIndex(c => c.id == editingCommentId);
                if(cmtIndex !== -1) post.comments[cmtIndex].content = finalContent;
                renderComments(post.comments, 'comment-list', isAdmin);
                cancelCommentEdit();
            }
            return;
        }

        if(isAdmin) { name = "하포카"; pw = ""; }
        else {
            if(!name) return showAlert("닉네임 입력");
            if(!pw) return showAlert("비번 입력");
        }

        let finalPw = pw;
        if(!isAdmin && pw) finalPw = await sha256(pw);

        document.getElementById('global-loader').classList.remove('hidden');
        try {
            const { data, error } = await dbClient.rpc('create_comment_secure', {
                p_post_id: currentPostId,
                p_author: name,
                p_password: finalPw,
                p_content: finalContent
            });

            if(error) throw error;
            const post = posts.find(p => p.id == currentPostId);
            if(!post.comments) post.comments = [];
            post.comments.push(data);
            renderComments(post.comments, 'comment-list', isAdmin);
            
            document.getElementById('cmtContent').value = '';
            document.getElementById('cmtPw').value = '';
            currentCommentImages = [];
            renderCommentImagePreview();
            cancelReply(); 
        } catch (e) { showAlert("실패: " + e.message); } 
        finally { document.getElementById('global-loader').classList.add('hidden'); }
    }

    function renderCommentImagePreview() {
        const container = document.getElementById('cmtImagePreview');
        if(currentCommentImages.length > 0) {
            container.classList.remove('hidden');
            container.innerHTML = '';
            currentCommentImages.forEach((src, idx) => {
                container.innerHTML += `<div class="cmt-preview-item"><img src="${src}"><div class="cmt-preview-remove" onclick="window.removeCommentImage(${idx})"><i class="fa-solid fa-xmark"></i></div></div>`;
            });
        } else {
            container.classList.add('hidden');
            container.innerHTML = '';
        }
    }

    function requestPasswordCheck(targetId, actionType) {
        let target = null;
        if(actionType.includes('post')) {
            target = posts.find(p => p.id == targetId);
        } else {
            const currentPost = posts.find(p => p.id == currentPostId);
            target = currentPost.comments.find(c => c.id == targetId || c.created_at == targetId); 
        }

        if (!target) return showAlert("항목을 찾을 수 없습니다.");
        if(isAdmin) { executeAction(actionType, targetId, target); return; }
        if(target.author === '하포카' || target.author === 'Admin') return showAlert("관리자 항목은 수정불가");

        pendingActionType = actionType;
        pendingTargetId = targetId;
        pendingTarget = target; 
        document.getElementById('verificationPw').value = '';
        document.getElementById('passwordModal').classList.remove('hidden');
        document.getElementById('verificationPw').focus();
    }

    async function confirmPasswordAction() {
        const inputPw = document.getElementById('verificationPw').value;
        if(!inputPw) return showAlert("비밀번호 입력 필요");
        if (!pendingTarget) return closePasswordModal();
        
        const dbClient = getDbClient();
        if (!dbClient) return showAlert("오프라인 상태에서는 확인할 수 없습니다.");

        const hashedInput = await sha256(inputPw);
        
        let isValid = false;
        
        if (pendingActionType.includes('post')) {
            const { data, error } = await dbClient.rpc('check_post_pw', { 
                post_id: pendingTargetId, 
                input_hash: hashedInput 
            });
            if (!error && data === true) isValid = true;
        } else {
            const { data, error } = await dbClient.rpc('check_comment_pw', { 
                comment_id: pendingTargetId, 
                input_hash: hashedInput 
            });
            if (!error && data === true) isValid = true;
        }

        if(isValid) {
            const a = pendingActionType;
            const i = pendingTargetId;
            const t = pendingTarget;
            document.getElementById('passwordModal').classList.add('hidden');
            pendingActionType = null;
            setTimeout(() => executeAction(a, i, t), 300);
        } else {
            showAlert("비밀번호 불일치");
            document.getElementById('verificationPw').value = '';
        }
    }

    function executeAction(type, id, targetObj) {
        if(type === 'delete_post') showConfirm("삭제하시겠습니까?", () => deletePost(id), "삭제", "삭제하기");
        else if(type === 'edit_post') goEditMode(targetObj);
        else if(type === 'delete_comment') showConfirm("삭제하시겠습니까?", () => deleteComment(id), "삭제", "삭제하기");
        else if(type === 'edit_comment') loadCommentForEdit(targetObj);
    }

    function goEditMode(post) {
        editingPostId = post.id;
        currentBoardType = post.type;
        document.getElementById('write-header').innerText = "글 수정하기";
        document.getElementById('inputTitle').value = post.title;
        currentEditorMode = 'html';
        document.getElementById('editorContentHtml').innerHTML = post.content;
        const mdArea = document.getElementById('editorContentMarkdown');
        if(mdArea) mdArea.value = post.content; 
        document.getElementById('inputName').value = post.author;
        document.getElementById('inputName').disabled = true;
        document.getElementById('inputPw').disabled = true;
        
        if(isAdmin) document.getElementById('checkPinned').checked = post.is_pinned || false;
        
        window.switchEditorTab('html');
        window.router('write', isAdmin);
    }

    async function deletePost(id) { 
        const dbClient = getDbClient();
        if(dbClient) { 
            await dbClient.from('posts').update({ deleted_at: new Date().toISOString(), status: 'deleted' }).eq('id', id);
            if(!document.getElementById('view-detail').classList.contains('hidden')) fetchPosts(currentBoardType); 
        } else { 
            posts = posts.filter(p => p.id != id); 
            saveLocalPosts(posts); 
            renderBoard(); 
        }
        showAlert("삭제되었습니다.");
        if(!document.getElementById('view-detail').classList.contains('hidden')) window.router(currentBoardType, isAdmin);
    }

    async function deleteComment(id) {
        const dbClient = getDbClient();
        if(dbClient) {
            const { error } = await dbClient.from('comments').update({ deleted_at: new Date().toISOString() }).eq('id', id);
            if(error) showAlert("삭제 실패");
            else {
                showAlert("삭제되었습니다.");
                const post = posts.find(p => p.id == currentPostId);
                if(post && post.comments) {
                    const idx = post.comments.findIndex(c => c.id == id);
                    if(idx !== -1) post.comments.splice(idx, 1);
                }
                renderComments(post ? post.comments : [], 'comment-list', isAdmin);
            }
        }
    }

    function reportCurrentPost() {
        if(!getDbClient() || !currentPostId) return showAlert("오프라인 상태에서는 신고할 수 없습니다.");

        showConfirm("정말 이 게시글을 신고하시겠습니까?", async () => {
            if (isAdmin) {
                try {
                    const { data: post } = await getDbClient().from('posts').select('reports').eq('id', currentPostId).single();
                    if (post) {
                        const newCount = (post.reports || 0) + 1;
                        const { error } = await getDbClient().from('posts').update({ reports: newCount }).eq('id', currentPostId);
                        if (error) throw error;
                        showAlert("관리자 권한으로 신고 처리되었습니다.");
                        readPost(currentPostId);
                    }
                } catch(e) {
                    showAlert("처리 실패: " + e.message);
                }
            } else {
                const { error } = await getDbClient().rpc('report_content_secure', {
                    p_type: 'post',
                    p_id: currentPostId
                });

                if(error) {
                    showAlert(error.message);
                } else {
                    showAlert("신고가 접수되었습니다.");
                    readPost(currentPostId); 
                }
            }
        }, "신고 확인", "신고하기");
    }

    async function togglePinPost() {
        if(!isAdmin || !currentPostId) return;
        
        const dbClient = getDbClient();
        const { data: post } = await dbClient.from('posts').select('is_pinned').eq('id', currentPostId).single();
        if(!post) return;

        const newStatus = !post.is_pinned;
        const { error } = await dbClient.from('posts').update({ is_pinned: newStatus }).eq('id', currentPostId);
        
        if(error) showAlert("고정 설정 실패");
        else {
            document.getElementById('btn-pin-post').innerHTML = newStatus ? '<i class="fa-solid fa-thumbtack"></i> 고정 해제' : '<i class="fa-solid fa-thumbtack"></i> 상단 고정';
            document.getElementById('btn-pin-post').classList.toggle('text-blue-600', newStatus);
            
            fetchPosts(currentBoardType);
        }
    }

    function movePostCategory(newType) {
        if(!newType || !currentPostId) return;
        
        const catName = { 'notice': '공지사항', 'free': '자유대화방', 'error': '오류해결소' }[newType];
        
        showConfirm(`이 게시글을 [${catName}]으로 이동하시겠습니까?`, async () => {
            const { error } = await getDbClient().from('posts').update({ type: newType }).eq('id', currentPostId);
            if(error) {
                showAlert("이동 실패: " + error.message);
            } else {
                showAlert("게시글이 이동되었습니다.");
                window.router('list'); 
            }
        }, "카테고리 이동", "이동");
        
        document.getElementById('move-category-select').value = "";
    }

    function cancelReply() {
        replyingToCommentId = null;
        document.getElementById('reply-target-box').classList.add('hidden');
    }

    function resetEditor() { 
        document.getElementById('inputTitle').value=''; 
        document.getElementById('inputName').value=''; 
        document.getElementById('inputPw').value=''; 
        document.getElementById('editorContentHtml').innerHTML='';
        editingPostId = null;
    }

    function loadCommentForEdit(cmt) {
        editingCommentId = cmt.id;
        document.getElementById('cmtName').value = cmt.author;
        document.getElementById('cmtName').disabled = true;
        document.getElementById('cmtPw').classList.add('hidden'); 
        let tempDiv = document.createElement('div');
        tempDiv.innerHTML = cmt.content;
        currentCommentImages = [];
        tempDiv.querySelectorAll('img').forEach(img => currentCommentImages.push(img.src));
        
        let htmlContent = cmt.content.replace(/<!-- parent_id:.*? -->/g, '');
        tempDiv.innerHTML = htmlContent;
        tempDiv.querySelectorAll('img').forEach(img => img.remove());
        let textOnly = tempDiv.innerHTML.replace(/<br\s*\/?>/gi, "\n").trim();
        if(textOnly.includes('<')) {
            let textParser = document.createElement('div');
            textParser.innerHTML = textOnly;
            textOnly = textParser.innerText;
        }

        document.getElementById('cmtContent').value = textOnly;
        document.getElementById('btn-submit-cmt').innerText = "수정완료";
        document.getElementById('btn-cmt-cancel').classList.remove('hidden');
        renderCommentImagePreview();
    }

    function cancelCommentEdit() {
        editingCommentId = null;
        document.getElementById('cmtName').value = isAdmin ? "하포카" : loadSavedNickname();
        document.getElementById('cmtName').disabled = isAdmin;
        if(!isAdmin) document.getElementById('cmtPw').classList.remove('hidden');
        document.getElementById('cmtPw').value = "";
        document.getElementById('cmtContent').value = "";
        document.getElementById('btn-submit-cmt').innerText = "등록";
        document.getElementById('btn-cmt-cancel').classList.add('hidden');
        currentCommentImages = [];
        renderCommentImagePreview();
    }

    function insertHtmlToEditorLocal(html) {
        if (typeof window.insertHtmlAtCursor === 'function') {
            window.insertHtmlAtCursor(html);
        } else {
            const editor = document.getElementById('editorContentHtml');
            if (editor) {
                editor.focus();
                document.execCommand('insertHTML', false, html);
            }
        }
    }

    async function processPostImage(file, mode) {
        try {
            if(typeof showGlobalLoader === 'function') showGlobalLoader(true);
            
            let imageUrl = null;
            if (typeof uploadImage === 'function') {
                 try {
                     imageUrl = await uploadImage(file);
                 } catch(e) {
                     console.error("Upload failed, falling back to local URL", e);
                 }
            }
            if (!imageUrl) {
                 imageUrl = URL.createObjectURL(file);
            }
    
            if (mode === 'html') {
                 insertHtmlToEditorLocal(`<img src="${imageUrl}" style="max-width:100%; margin: 10px 0; display: block;"><p><br></p>`);
            } else {
                 const mdText = document.getElementById('editorContentMarkdown');
                 const start = mdText.selectionStart;
                 const end = mdText.selectionEnd;
                 const text = mdText.value;
                 const newText = text.substring(0, start) + `\n![이미지](${imageUrl})\n` + text.substring(end);
                 mdText.value = newText;
                 if(typeof updateMarkdownPreview === 'function') updateMarkdownPreview();
            }
        } catch (e) {
            if(typeof openAlert === 'function') openAlert('업로드 실패', e.message);
        } finally {
            if(typeof showGlobalLoader === 'function') showGlobalLoader(false);
        }
    }

    function processCommentImages(files, currentImagesArray, renderCallback) {
        Array.from(files).forEach(file => {
            if (typeof uploadImage === 'function') {
                uploadImage(file).then(url => {
                     currentImagesArray.push(url);
                     renderCallback();
                }).catch(e => {
                     console.error(e);
                     currentImagesArray.push(URL.createObjectURL(file));
                     renderCallback();
                });
            } else {
                currentImagesArray.push(URL.createObjectURL(file));
                renderCallback();
            }
        });
    }
}
