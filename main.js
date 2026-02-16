var pendingActionType = null;
var pendingTarget = null;
var pendingTargetId = null;

var isSubmitting = false;

if (!window.hasMainJsRun) {
    window.hasMainJsRun = true;
    window.currentEditorMode = 'html';
    window.isWriting = false;

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
        
        const rawHash = window.location.hash;
        const initialHash = rawHash.startsWith('#') ? decodeURIComponent(rawHash.substring(1)) : '';
        const hashParts = initialHash.split('/');
        const pageCode = hashParts[0];
        const paramId = hashParts[1];

        const realPage = (typeof getPageFromCode === 'function') ? getPageFromCode(pageCode) : 'home'; 
        
        if (realPage === 'write') {
            window.router('write', false);
            if(loader) setTimeout(() => loader.classList.add('hidden'), 300);
            
            if (typeof loadTempPost === 'function') {
                setTimeout(loadTempPost, 100);
            }
        }
        else if (realPage === 'detail') { 
            let targetId = paramId;
            if (!targetId) {
                targetId = localStorage.getItem('aa_current_post_id');
            }

            if (targetId) {
                readPost(targetId).then(() => {
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

    window.requestPasswordCheck = function(targetId, actionType) {
        let target = null;
        if(actionType.includes('post')) {
            target = posts.find(p => p.id == targetId);
        } else {
            const currentPost = posts.find(p => p.id == currentPostId);
            target = currentPost.comments.find(c => c.id == targetId || c.created_at == targetId); 
        }

        if (!target) return showAlert("항목을 찾을 수 없습니다.");
        if(isAdmin) { executeAction(actionType, targetId, target); return; }
        if(target.author === '하포카' || target.author === 'Admin') return showAlert("공지사항 수정 및 삭제 불가");

        pendingActionType = actionType;
        pendingTargetId = targetId;
        pendingTarget = target; 
        document.getElementById('verificationPw').value = '';
        document.getElementById('passwordModal').classList.remove('hidden');
        document.getElementById('verificationPw').focus();
    }

    window.confirmPasswordAction = async function() {
        const inputPw = document.getElementById('verificationPw').value.trim();
        if(!inputPw) return showAlert("비밀번호 입력 필요");
        if (!pendingTarget) return closePasswordModal();
        
        const dbClient = getDbClient();
        if (!dbClient) return showAlert("오프라인 상태에서는 확인할 수 없습니다.");

        const hashedInput = await sha256(inputPw);
        
        let isValid = false;
        
        try {
            if (pendingActionType.includes('post')) {
                const { data, error } = await dbClient.rpc('check_post_pw', { 
                    post_id: pendingTargetId, 
                    input_hash: hashedInput 
                });
                
                if (error) {
                    console.error("Password check error:", error);
                    if(error.code === '42883') return showAlert("DB 함수 오류: 관리자에게 문의하세요.");
                    else return showAlert("오류 발생: " + error.message);
                }
                
                if (data === true) isValid = true;
            } else {
                const { data, error } = await dbClient.rpc('check_comment_pw', { 
                    comment_id: pendingTargetId, 
                    input_hash: hashedInput 
                });
                
                if (error) {
                    console.error("Password check error:", error);
                     if(error.code === '42883') return showAlert("DB 함수 오류: 관리자에게 문의하세요.");
                     else return showAlert("오류 발생: " + error.message);
                }

                if (data === true) isValid = true;
            }
        } catch (e) {
            console.error("System error:", e);
            return showAlert("시스템 오류 발생");
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

    window.closePasswordModal = () => document.getElementById('passwordModal').classList.add('hidden');
    window.closeConfirm = closeConfirm;
    window.closeAlert = closeAlert;

    function executeAction(type, id, targetObj) {
        if(type === 'delete_post') showConfirm("삭제하시겠습니까?", () => deletePost(id), "삭제", "삭제하기");
        else if(type === 'edit_post') goEditMode(targetObj);
        else if(type === 'delete_comment') showConfirm("삭제하시겠습니까?", () => deleteComment(id), "삭제", "삭제하기");
        else if(type === 'edit_comment') loadCommentForEdit(targetObj);
    }
}
