const SUPABASE_URL = "https://furdwhmgplodjkemkxkm.supabase.co"; 
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1cmR3aG1ncGxvZGprZW1reGttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5NjkyMDAsImV4cCI6MjA4MTU0NTIwMH0.Om___1irBNCjya4slfaWqJeUVoyVCvvMaDHKwYm3yg0"; 
const RECAPTCHA_SITE_KEY = '6LctpzAsAAAAAOgrbueew_LT_KmAuPkU3pcg6ozD';

const TOP_NOTICE = { 
    enabled: true,
    useGithub: true,
    githubUrl: "https://raw.githubusercontent.com/Pretsg/Archeage_auto/main/notice_top.txt",
    text: "공지사항을 불러오는 중...",
    bgColor: "#1e293b",
    textColor: "#ffffff"
};

window.ENABLE_SNOW = false;
const PAGE_SIZE = 10;
const ADMIN_PAGE_SIZE = 10;

const ROUTE_MAP = {
    'home': 'fme120e0f',        
    'notice': '5a105e8b',  
    'free': 'ad023482',    
    'list': 'b3a8e0e1',    
    'admin': '9f86d081',   
    'write': '11e389c9',   
    'search': '05972be4',  
    'detail': '7c2b3e4f',  
    'test': 'e1234567'
};

var posts = [];
var currentBoardType = 'notice'; 
var editingPostId = null;
var errorViewMode = 'grid'; 
var currentPostId = null; 
var isAdmin = false; 
var lastPage = 'home';
var currentCommentImages = [];
var editingCommentId = null;
var replyingToCommentId = null; 
var replyingToCommentAuthor = null;
var currentEditorMode = 'html'; 
var isBanned = false;
var currentPage = 1;
var totalCount = 0;

const particlesConfig = {
  "particles": {
    "number": { "value": 100, "density": { "enable": true, "value_area": 800 } },
    "color": { "value": "#ffffff" },
    "shape": { "type": "circle", "stroke": { "width": 0, "color": "#000000" }, "polygon": { "nb_sides": 5 } },
    "opacity": { "value": 0.8, "random": true, "anim": { "enable": false, "speed": 1, "opacity_min": 0.1, "sync": false } },
    "size": { "value": 5, "random": true, "anim": { "enable": false, "speed": 40, "size_min": 0.1, "sync": false } },
    "line_linked": { "enable": false, "distance": 500, "color": "#ffffff", "opacity": 0.4, "width": 2 },
    "move": { "enable": true, "speed": 3, "direction": "bottom", "random": false, "straight": false, "out_mode": "out", "bounce": false, "attract": { "enable": false, "rotateX": 600, "rotateY": 1200 } }
  },
  "interactivity": {
    "detect_on": "canvas",
    "events": { "onhover": { "enable": true, "mode": "repulse" }, "onclick": { "enable": true, "mode": "push" }, "resize": true },
    "modes": { "grab": { "distance": 400, "line_linked": { "opacity": 1 } }, "bubble": { "distance": 400, "size": 40, "duration": 2, "opacity": 8, "speed": 3 }, "repulse": { "distance": 200, "duration": 0.4 }, "push": { "particles_nb": 4 }, "remove": { "particles_nb": 2 } }
  },
  "retina_detect": true
};
