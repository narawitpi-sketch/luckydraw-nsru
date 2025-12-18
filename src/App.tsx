import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, type User } from 'firebase/auth';
import { 
  getFirestore, collection, doc, setDoc, getDoc, 
  onSnapshot, updateDoc, getDocs, deleteDoc
} from 'firebase/firestore';
import { Gift, Smartphone, UserPlus, Trophy, PartyPopper, RefreshCw, Sparkles, Settings, Star } from 'lucide-react';
import { motion, useAnimation } from 'framer-motion';

// --- Firebase Configuration ---
const firebaseConfig = {
    apiKey: "AIzaSyD8vFAEhmjSZlrVw8PgkKVvxqaQ1_7deWc",
    authDomain: "luckydraw-nsru.firebaseapp.com",
    projectId: "luckydraw-nsru",
    storageBucket: "luckydraw-nsru.firebasestorage.app",
    messagingSenderId: "113585240182",
    appId: "1:113585240182:web:41f6b8b26f60bd177d4757",
    measurementId: "G-LJF5RZRSEC"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'my-new-year-party';

// --- Type Definitions ---
interface Participant {
  id: string;
  name: string;
  phone: string;
  hasWon: boolean;
  timestamp: string;
}

interface FormDataState {
  name: string;
  phone: string;
}

// --- Animation Constants ---

const ITEM_HEIGHT = 80; // ความสูงของแต่ละชื่อ (pixel)
const VISIBLE_ITEMS = 5; // จำนวนชื่อที่แสดงในช่องหน้าต่าง
const CONTAINER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS; // ความสูงรวมของช่องหน้าต่าง

// --- Helper Functions ---
const shuffleArray = <T,>(array: T[]): T[] => {
  return array.slice().sort(() => Math.random() - 0.5);
};

// --- Component ---
export default function NewYearRaffle() {
  const [user, setUser] = useState<User | null>(null);
  const [mode, setMode] = useState<'register' | 'projector'>('register');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [myRegistration, setMyRegistration] = useState<Participant | null>(null);
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [showConfetti, setShowConfetti] = useState<boolean>(false);
  const [winner, setWinner] = useState<Participant | null>(null);
  const [reelNames, setReelNames] = useState<Participant[]>([]);
  
  const animationControls = useAnimation();

  // Form State
  const [formData, setFormData] = useState<FormDataState>({ name: '', phone: '' });
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [isAdminMenuOpen, setIsAdminMenuOpen] = useState<boolean>(false);
  const [isPasswordPromptVisible, setIsPasswordPromptVisible] = useState<boolean>(false);
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [passwordError, setPasswordError] = useState<string>('');

  // Filter out winners
  const eligibleParticipants = useMemo(() => participants.filter(p => !p.hasWon), [participants]);

  const handleGoToProjector = () => {
    setIsPasswordPromptVisible(true);
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === "nsru@2026") {
      setMode('projector');
      setIsPasswordPromptVisible(false);
      setPasswordInput('');
      setPasswordError('');
    } else {
      setPasswordError("รหัสผ่านไม่ถูกต้อง!");
      setPasswordInput('');
    }
  };

  // 1. Auth & Initial Setup
  useEffect(() => {
    signInAnonymously(auth).catch(error => console.error("Auth Error", error));
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    const savedPhone = localStorage.getItem('raffle_phone');
    if (savedPhone) {
        setFormData(prev => ({ ...prev, phone: savedPhone }));
    }
    return () => unsubscribe();
  }, []);

  // 2. Data Syncing (Participants)
  useEffect(() => {
    if (!user) return;
    const q = collection(db, 'artifacts', appId, 'public', 'data', 'participants');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Participant));
      setParticipants(data);
    });
    return () => unsubscribe();
  }, [user]);

  // 3. Check My Status
  useEffect(() => {
    if (!user || !formData.phone) return;
    const myDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'participants', formData.phone);
    const unsubscribe = onSnapshot(myDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as Participant;
        setMyRegistration(data);
        localStorage.setItem('raffle_phone', formData.phone);
        localStorage.setItem('raffle_name', data.name);
        if (data.hasWon) {
           setShowConfetti(true);
        }
      }
    });
    return () => unsubscribe();
  }, [user, formData.phone]);

  // --- Actions ---

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) {
      setError('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'participants', formData.phone);
      if (!(await getDoc(docRef)).exists()) {
         const newParticipant: Omit<Participant, 'id'> = {
           name: formData.name,
           phone: formData.phone,
           hasWon: false,
           timestamp: new Date().toISOString()
         };
         await setDoc(docRef, newParticipant);
      }
      localStorage.setItem('raffle_phone', formData.phone);
    } catch (err) {
      console.error(err);
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่');
    } finally {
      setLoading(false);
    }
  };
  
  const startSpin = () => {
    if (eligibleParticipants.length < 1) {
      alert("ไม่มีผู้เข้าร่วมที่ยังไม่ได้รับรางวัลเหลือแล้ว!");
      return;
    }

    setIsSpinning(true);
    setShowConfetti(false);
    setWinner(null);
    animationControls.set({ y: 0 }); // Reset position

    // 1. เลือกผู้ชนะไว้ล่วงหน้า
    const selectedWinner = eligibleParticipants[Math.floor(Math.random() * eligibleParticipants.length)];
    setWinner(selectedWinner);
    
    // 2. สร้าง "Reel" หรือสายพานรายชื่อยาวๆ
    // เทคนิค: เอา list มาต่อกันหลายๆ รอบ + ผู้ชนะ + ต่อท้ายอีกนิดหน่อยเพื่อให้หยุดกลางจอพอดี
    
    let tempReel: Participant[] = [];
    
    // 2.1 ช่วงหมุนเล่น (Filler) - ยิ่งเยอะยิ่งหมุนนาน
    // ถ้าคนน้อย (เช่น < 10) ให้วนเยอะรอบหน่อย (เช่น 30 รอบ) ถ้าคนเยอะ (เช่น 100) วนน้อยรอบ (เช่น 5 รอบ)
    const loops = eligibleParticipants.length < 10 ? 30 : 5;
    
    for (let i = 0; i < loops; i++) {
        tempReel = [...tempReel, ...shuffleArray(eligibleParticipants)];
    }

    // 2.2 ใส่ผู้ชนะลงไปที่ตำแหน่ง "เกือบสุดท้าย"
    // ต้องแน่ใจว่าผู้ชนะไม่ได้อยู่ท้ายสุด เพื่อให้มีพื้นที่เหลือด้านล่าง (padding bottom)
    const winnerIndex = tempReel.length; // ตำแหน่งที่จะใส่ผู้ชนะ
    tempReel.push(selectedWinner);

    // 2.3 ใส่ตัวหลอกต่อท้ายอีกสัก 3-4 คน เพื่อให้ไม่เห็นขอบขาวด้านล่างตอนหยุด
    const paddingCount = 4; 
    const paddingItems = shuffleArray(eligibleParticipants).slice(0, paddingCount);
    tempReel = [...tempReel, ...paddingItems];

    setReelNames(tempReel);

    // 3. คำนวณระยะทางที่จะเลื่อน (Pixels)
    // สูตร: -(ตำแหน่งผู้ชนะ * ความสูง) + (ครึ่งหนึ่งของความสูงกล่อง) - (ครึ่งหนึ่งของความสูงไอเท็ม)
    // เพื่อให้ item ของผู้ชนะมาหยุดตรงกลางเป๊ะๆ
    const targetY = -(winnerIndex * ITEM_HEIGHT) + (CONTAINER_HEIGHT / 2) - (ITEM_HEIGHT / 2);

    // 4. เริ่ม Animation
    animationControls.start({
      y: targetY,
      transition: {
        duration: 6, // หมุนนาน 6 วินาที
        ease: [0.15, 0.85, 0.35, 1], // Cubic Bezier เพื่อให้เริ่มเร็วและหยุดนิ่มๆ (เหมือน slot)
      }
    }).then(() => {
        handleAnimationComplete(selectedWinner);
    });
  };

  const handleAnimationComplete = (confirmedWinner: Participant) => {
      setIsSpinning(false);
      setShowConfetti(true);
      if(confirmedWinner) {
        const winnerRef = doc(db, 'artifacts', appId, 'public', 'data', 'participants', confirmedWinner.id);
        updateDoc(winnerRef, { hasWon: true });
      }
  };

  const resetWinners = async () => {
    if (!window.confirm("คุณแน่ใจหรือไม่ที่จะรีเซ็ตสถานะผู้ชนะทั้งหมด?")) return;
    try {
        const updates = participants.filter(p => p.hasWon).map(p => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'participants', p.id), { hasWon: false }));
        await Promise.all(updates);
        setWinner(null);
        setShowConfetti(false);
        setIsAdminMenuOpen(false);
        animationControls.set({ y: 0 }); 
        alert("รีเซ็ตสถานะผู้ชนะสำเร็จ!");
    } catch (e: unknown) {
        if (e instanceof Error) alert("รีเซ็ตไม่สำเร็จ: " + e.message);
    }
  };
  
  const resetData = async () => {
    const pass = prompt("การกระทำนี้จะลบข้อมูลทั้งหมดและไม่สามารถย้อนกลับได้! \nกรุณาใส่รหัสผ่านผู้ดูแลระบบเพื่อยืนยัน:");
    if (pass !== "nsru@2026") {
        if (pass !== null) alert("รหัสผ่านไม่ถูกต้อง! การลบข้อมูลถูกยกเลิก");
        return;
    }
    
    try {
        const querySnapshot = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'participants'));
        await Promise.all(querySnapshot.docs.map((docSnap) => deleteDoc(docSnap.ref)));
        window.location.reload();
    } catch(e: unknown) {
        if (e instanceof Error) alert("ลบข้อมูลไม่สำเร็จ: " + e.message);
    }
  };

  // --- Views ---

  if (mode === 'projector') {
    return (
      <div className="min-h-screen bg-ny-blue text-white flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
        {/* Ornaments */}
        <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none">
             <div className="absolute top-10 left-10 text-6xl text-ny-gold animate-pulse">✨</div>
             <div className="absolute bottom-20 right-20 text-8xl text-ny-gold animate-bounce">🎁</div>
        </div>

        {/* Admin Menu */}
        <div className="absolute top-4 right-4 z-30">
            <button onClick={() => setIsAdminMenuOpen(!isAdminMenuOpen)} className="bg-gray-800/90 backdrop-blur-sm p-3 text-white rounded-full shadow-lg hover:bg-gray-700 transition-colors" aria-label="เมนูผู้ดูแล">
                <Settings size={20} />
            </button>
            {isAdminMenuOpen && (
                 <div className="absolute top-14 right-0 bg-gray-900/90 backdrop-blur-sm p-4 text-white text-sm rounded-lg shadow-lg w-64 border border-gray-700">
                      <h3 className="font-bold mb-3 border-b border-gray-600 pb-2">เมนูผู้ดูแล</h3>
                      <div className="flex flex-col gap-2">
                          <button onClick={resetWinners} className="bg-yellow-600 py-2 rounded hover:bg-yellow-500 w-full text-center flex items-center justify-center gap-2 transition-colors"><RefreshCw size={14}/> รีเซ็ตผู้ชนะ</button>
                          <button onClick={resetData} className="bg-red-800 py-2 rounded hover:bg-red-700 w-full text-center flex items-center justify-center gap-2 transition-colors"><RefreshCw size={14}/> ล้างข้อมูลทั้งหมด</button>
                          <div className="h-px bg-gray-600 my-2"></div>
                          <button onClick={() => setMode('register')} className="bg-gray-600 py-2 rounded hover:bg-gray-500 w-full text-center flex items-center justify-center gap-1 transition-colors"><Smartphone size={14}/> กลับไปหน้าลงทะเบียน</button>
                      </div>
                 </div>
            )}
        </div>

        <div className="z-10 w-full max-w-4xl text-center flex flex-col items-center">
          <h1 className="text-4xl md:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-ny-gold to-yellow-400 mb-8 drop-shadow-lg">
            🎉 จับรางวัลปีใหม่ 2026 🎉
          </h1>

          {/* --- The Vertical Slot Machine --- */}
          <div className="relative mb-10 w-full max-w-md">
            
            {/* Machine Frame */}
            <div className="bg-gradient-to-br from-gray-700 to-gray-900 p-4 rounded-3xl shadow-2xl border-4 border-ny-gold relative">
                
                {/* Viewport Window */}
                <div 
                    className="w-full bg-white rounded-xl shadow-inner overflow-hidden relative"
                    style={{ height: CONTAINER_HEIGHT }}
                >
                    {/* Center Highlight Bar (The red line/box) */}
                    <div className="absolute top-1/2 left-0 -translate-y-1/2 w-full h-[80px] bg-red-500/10 border-y-2 border-red-500/50 z-20 pointer-events-none shadow-[0_0_15px_rgba(239,68,68,0.3)]"></div>
                    
                    {/* Top Fade Gradient */}
                    <div className="absolute top-0 left-0 w-full h-16 bg-gradient-to-b from-gray-200 to-transparent z-10 pointer-events-none"></div>
                    {/* Bottom Fade Gradient */}
                    <div className="absolute bottom-0 left-0 w-full h-16 bg-gradient-to-t from-gray-200 to-transparent z-10 pointer-events-none"></div>

                    {/* The Moving Reel */}
                    <motion.div
                        className="flex flex-col items-center w-full"
                        animate={animationControls}
                    >
                        {/* Initial State (Placeholder) */}
                        {!isSpinning && reelNames.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full w-full py-20 text-gray-400">
                                <div style={{ height: ITEM_HEIGHT }} className="flex items-center justify-center text-3xl font-bold opacity-50">?</div>
                                <div style={{ height: ITEM_HEIGHT }} className="flex items-center justify-center text-3xl font-bold opacity-50">?</div>
                                <div style={{ height: ITEM_HEIGHT }} className="flex items-center justify-center text-4xl font-bold text-gray-800">พร้อมสุ่ม</div>
                                <div style={{ height: ITEM_HEIGHT }} className="flex items-center justify-center text-3xl font-bold opacity-50">?</div>
                                <div style={{ height: ITEM_HEIGHT }} className="flex items-center justify-center text-3xl font-bold opacity-50">?</div>
                            </div>
                        )}

                        {/* Actual Names */}
                        {reelNames.map((p, i) => (
                            <div 
                                key={`${p.id}-${i}`} 
                                style={{ height: ITEM_HEIGHT }}
                                className={`w-full flex items-center justify-center text-center font-bold text-3xl px-4
                                    ${winner && p.id === winner.id && i === reelNames.length - 1 - 4 ? 'text-red-600 scale-110' : 'text-gray-700'}
                                `}
                            >
                                <span className="truncate w-full">{p.name}</span>
                            </div>
                        ))}
                    </motion.div>
                </div>
            </div>

            {/* Stats */}
            <div className="mt-4 flex justify-between items-center px-4 text-sm">
                 <div className="text-gray-300 font-semibold bg-black/30 px-3 py-1 rounded-full">ผู้เข้าร่วม: {participants.length} คน</div>
                 <div className="text-gray-300 font-semibold bg-black/30 px-3 py-1 rounded-full">แจกแล้ว: {participants.filter(p=>p.hasWon).length} คน</div>
            </div>
          </div>


          <div className="flex gap-4 justify-center">
             <button onClick={startSpin} disabled={isSpinning || eligibleParticipants.length === 0} className={`px-12 py-6 rounded-full text-2xl font-bold shadow-lg transition-all transform hover:-translate-y-1 active:translate-y-1 ${isSpinning ? 'bg-gray-500 cursor-not-allowed text-gray-300' : 'bg-gradient-to-b from-ny-gold to-yellow-600 text-black border-b-4 border-yellow-800 hover:brightness-110'}`}>
               {isSpinning ? 'กำลังหมุน...' : '🕹️ สุ่มรางวัล!'}
             </button>
          </div>
          
          {showConfetti && winner && (
             <div className="mt-8 animate-bounce z-30">
                <div className="text-2xl text-ny-gold mb-2 flex items-center justify-center gap-3"><Star/> ขอแสดงความยินดีกับ <Star/></div>
                <div className="text-5xl font-bold text-black bg-ny-gold/90 px-8 py-4 rounded-xl inline-block backdrop-blur-sm border-2 border-yellow-300 shadow-[0_0_30px_rgba(234,179,8,0.6)]">
                    {winner.name}
                </div>
                <div className="text-lg text-gray-300 mt-2">เบอร์โทร: {winner.phone.substring(0, 3)}-xxxx-{winner.phone.substring(winner.phone.length - 3)}</div>
             </div>
          )}
        </div>
      </div>
    );
  }

  // --- Registration View ---
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4 font-sans text-slate-800 relative">
      {isPasswordPromptVisible && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm">
            <h3 className="text-xl font-bold text-slate-800 mb-4">เข้าสู่โหมดผู้ดูแล</h3>
            <form onSubmit={handlePasswordSubmit}>
              <p className="text-sm text-slate-600 mb-4">กรุณาใส่รหัสผ่านเพื่อดำเนินการต่อ</p>
              {passwordError && <div className="bg-red-100 text-red-700 p-3 rounded-lg text-sm mb-4 border border-red-200">{passwordError}</div>}
              <input type="password" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-ny-gold focus:border-transparent outline-none transition" placeholder="******" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} autoFocus />
              <div className="flex gap-4 mt-6">
                <button type="button" onClick={() => { setIsPasswordPromptVisible(false); setPasswordInput(''); setPasswordError(''); }} className="w-full bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-2 rounded-lg transition-colors">ยกเลิก</button>
                <button type="submit" className="w-full bg-ny-blue hover:bg-blue-900 text-white font-bold py-2 rounded-lg transition-colors">ยืนยัน</button>
              </div>
            </form>
          </div>
        </div>
      )}
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
        <div className="bg-ny-blue p-6 text-center relative">
          <Gift className="w-12 h-12 text-ny-gold mx-auto mb-2" />
          <h2 className="text-2xl font-bold text-white">ลงทะเบียนชิงโชคปีใหม่</h2>
          <p className="text-blue-200 text-sm">New Year Party 2026</p>
        </div>
        <div className="p-8">
          {myRegistration ? (
            <div className="text-center space-y-6">
               {myRegistration.hasWon ? (
                   <div className="animate-pulse space-y-4 py-8">
                       <Trophy className="w-24 h-24 text-ny-gold mx-auto drop-shadow-md" />
                       <h3 className="text-3xl font-bold text-ny-blue">ยินดีด้วย!!!</h3>
                       <p className="text-xl text-slate-700">คุณได้รับรางวัลแล้ว</p>
                       <div className="bg-yellow-100 text-yellow-800 px-4 py-2 rounded-lg inline-block border border-yellow-300">คุณ {myRegistration.name}</div>
                       <p className="text-sm text-gray-500 mt-4">กรุณาติดต่อรับรางวัลที่หน้าเวที</p>
                   </div>
               ) : (
                   <div className="space-y-4">
                       <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto"><Sparkles className="text-ny-blue w-10 h-10" /></div>
                       <h3 className="text-xl font-semibold text-ny-blue">ลงทะเบียนสำเร็จ!</h3>
                       <div className="bg-slate-100 p-4 rounded-lg text-left">
                           <p className="text-xs text-gray-500 mb-1">ชื่อที่ลงทะเบียน</p>
                           <p className="font-medium text-lg">{myRegistration.name}</p>
                           <div className="h-px bg-gray-200 my-2"></div>
                           <p className="text-xs text-gray-500 mb-1">เบอร์โทรศัพท์</p>
                           <p className="font-medium text-lg font-mono">{myRegistration.phone}</p>
                       </div>
                       <p className="text-sm text-gray-500">กรุณารอที่หน้านี้... ระบบจะแจ้งเตือนเมื่อคุณถูกรางวัล</p>
                   </div>
               )}
            </div>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              {error && <div className="bg-red-100 text-red-700 p-3 rounded-lg text-sm flex items-center gap-2 border border-red-200"><span>⚠️</span> {error}</div>}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">ชื่อ - นามสกุล (หรือชื่อเล่น)</label>
                <div className="relative">
                    <UserPlus className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                    <input type="text" className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-ny-gold focus:border-transparent outline-none transition" placeholder="เช่น สมชาย ใจดี" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} disabled={loading} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">เบอร์โทรศัพท์ (ใช้เป็น ID)</label>
                <div className="relative">
                    <Smartphone className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                    <input type="tel" className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-ny-gold focus:border-transparent outline-none transition" placeholder="08xxxxxxxx" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value.replace(/\D/g,'')})} maxLength={10} disabled={loading} />
                </div>
                <p className="text-xs text-gray-400 mt-1">* เบอร์โทรศัพท์ใช้เพื่อยืนยันตัวตนเท่านั้น</p>
              </div>
              <button type="submit" disabled={loading} className="w-full bg-ny-blue hover:bg-blue-900 text-white font-bold py-3 rounded-lg shadow-lg transform active:scale-95 transition-all flex items-center justify-center gap-2">
                {loading ? 'กำลังบันทึก...' : 'ลงทะเบียนร่วมสนุก'} 
                {!loading && <PartyPopper size={18} />}
              </button>
            </form>
          )}
        </div>
        <div className="bg-gray-50 p-4 flex justify-between items-center text-xs text-gray-400 border-t border-gray-100">
           <span>New Year Lucky Draw NSRU System © 2026</span>
           <button onClick={handleGoToProjector} className="text-gray-400 hover:text-gray-700"><Settings size={18} /></button>
        </div>
      </div>
    </div>
  );
}