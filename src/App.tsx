import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, type User } from 'firebase/auth';
import { 
  getFirestore, collection, doc, setDoc, getDoc, 
  onSnapshot, updateDoc, getDocs, deleteDoc
} from 'firebase/firestore';
import { Gift, Smartphone, UserPlus, Trophy, PartyPopper, RefreshCw, Sparkles as IconSparkles, Settings, Star } from 'lucide-react';
import { motion, useAnimation } from 'framer-motion';
import ReactConfetti from 'react-confetti';


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
const ITEM_HEIGHT = 192; /* 12rem, same as h-48 */ 
const NUM_ROTATIONS = 4; 

// --- Helper Hooks & Functions ---
const useWindowSize = () => {
  const [size, setSize] = useState([0, 0]);
  useEffect(() => {
    const updateSize = () => setSize([window.innerWidth, window.innerHeight]);
    window.addEventListener('resize', updateSize);
    updateSize();
    return () => window.removeEventListener('resize', updateSize);
  }, []);
  return { width: size[0], height: size[1] };
};

const shuffleArray = <T,>(array: T[]): T[] => {
  return array.slice().sort(() => Math.random() - 0.5);
};

// --- Sub-components ---
const Sparkles = () => {
    return (
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        {[...Array(30)].map((_, i) => {
          const style = {
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 5}s`,
            animationDuration: `${2 + Math.random() * 3}s`,
          };
          return (
            <div key={i} className="absolute w-1 h-1 bg-ny-gold rounded-full animate-pulse" style={style} />
          );
        })}
      </div>
    );
};


// --- Main Component ---
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
  const viewportRef = useRef<HTMLDivElement>(null);
  const { width, height } = useWindowSize();

  // Form State
  const [formData, setFormData] = useState<FormDataState>({ name: '', phone: '' });
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [isAdminMenuOpen, setIsAdminMenuOpen] = useState<boolean>(false);
  const [isPasswordPromptVisible, setIsPasswordPromptVisible] = useState<boolean>(false);
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [passwordError, setPasswordError] = useState<string>('');

  const eligibleParticipants = useMemo(() => participants.filter(p => !p.hasWon), [participants]);

  const handleGoToProjector = () => setIsPasswordPromptVisible(true);

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

  useEffect(() => {
    signInAnonymously(auth).catch(error => console.error("Auth Error", error));
    const unsubscribe = onAuthStateChanged(auth, u => setUser(u));
    const savedPhone = localStorage.getItem('raffle_phone');
    if (savedPhone) setFormData(prev => ({ ...prev, phone: savedPhone }));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = collection(db, 'artifacts', appId, 'public', 'data', 'participants');
    const unsubscribe = onSnapshot(q, snapshot => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Participant));
      setParticipants(data);
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user || !formData.phone) return;
    const myDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'participants', formData.phone);
    const unsubscribe = onSnapshot(myDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as Participant;
        setMyRegistration(data);
        localStorage.setItem('raffle_phone', formData.phone);
        localStorage.setItem('raffle_name', data.name);
        if (data.hasWon) setShowConfetti(true);
      }
    });
    return () => unsubscribe();
  }, [user, formData.phone]);

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

    const selectedWinner = eligibleParticipants[Math.floor(Math.random() * eligibleParticipants.length)];
    setWinner(selectedWinner);
    
    // Create a shuffled list for the final "rotation" to land on
    const finalRotation = shuffleArray(eligibleParticipants);
    const winnerIndexInFinalRotation = finalRotation.findIndex(p => p.id === selectedWinner.id);

    // Create the full reel for the animation
    let finalReel: Participant[] = [];
    for (let i = 0; i < NUM_ROTATIONS; i++) {
        finalReel.push(...shuffleArray(eligibleParticipants));
    }
    finalReel.push(...finalRotation);
    setReelNames(finalReel);

    // Calculate the distance to the winner
    const preWinnerReelSize = finalReel.length - finalRotation.length;
    const winnerPosition = preWinnerReelSize + winnerIndexInFinalRotation;
    
    const viewportHeight = viewportRef.current?.offsetHeight ?? 0;
    const centeringAdjustment = (viewportHeight / 2) - (ITEM_HEIGHT / 2);
    
    const totalDistance = (winnerPosition * ITEM_HEIGHT) - centeringAdjustment;

    animationControls.start({
      y: -totalDistance,
      transition: {
        type: 'spring',
        damping: 18,
        stiffness: 50,
        mass: 1.5,
        bounce: 0.1,
        duration: 9
      }
    });
  };

  const handleAnimationComplete = () => {
      setIsSpinning(false);
      setShowConfetti(true);
      if(winner) {
        const winnerRef = doc(db, 'artifacts', appId, 'public', 'data', 'participants', winner.id);
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
        animationControls.set({ x: 0 });
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

  if (mode === 'projector') {
    return (
      <div className="min-h-screen bg-ny-blue text-white flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
        <Sparkles />
        {showConfetti && <ReactConfetti width={width} height={height} numberOfPieces={300} recycle={false} />}
        
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

          <div className="bg-gradient-to-br from-gray-700 to-gray-900 p-4 rounded-3xl shadow-2xl border-4 border-ny-gold mb-10 w-full max-w-4xl relative">
            <div ref={viewportRef} className="h-48 w-full rounded-xl bg-white/90 shadow-inner overflow-hidden relative">
              <div className="absolute left-1/2 top-0 -translate-x-1/2 w-1.5 h-full bg-red-500/80 z-20 shadow-lg shadow-red-500/50 rounded-full"></div>
              
              <motion.div className="h-full flex items-center" animate={animationControls} onAnimationComplete={handleAnimationComplete}>
                {reelNames.map((p, i) => (
                  <div key={`${i}-${p.id}`} className="h-full flex-shrink-0 flex items-center justify-center text-center text-gray-800 font-bold text-4xl" style={{ width: ITEM_WIDTH }}>
                    <span className="truncate px-4">{p.name}</span>
                  </div>
                ))}
              </motion.div>
            </div>
            <div className="mt-4 flex justify-between items-center px-4">
                 <div className="text-gray-300 font-semibold">ผู้เข้าร่วม: {participants.length} คน</div>
                 <div className="text-gray-300 font-semibold">ผู้โชคดีแล้ว: {participants.filter(p=>p.hasWon).length} คน</div>
            </div>
          </div>

          <div className="flex gap-4 justify-center">
             <button onClick={startSpin} disabled={isSpinning || eligibleParticipants.length === 0} className={`px-12 py-6 rounded-full text-2xl font-bold shadow-lg transition-all transform hover:-translate-y-1 active:translate-y-1 ${isSpinning ? 'bg-gray-500 cursor-not-allowed text-gray-300' : 'bg-gradient-to-b from-ny-gold to-yellow-600 text-black border-b-4 border-yellow-800 hover:brightness-110'}`}>
               {isSpinning ? 'กำลังหมุน...' : '🕹️ สุ่มรางวัล!'}
             </button>
          </div>
          
          {showConfetti && winner && (
             <div className="mt-8 animate-bounce">
                <div className="text-2xl text-ny-gold mb-2 flex items-center justify-center gap-3"><Star/> ขอแสดงความยินดีกับ <Star/></div>
                <div className="text-5xl font-bold text-black bg-ny-gold/90 px-8 py-4 rounded-xl inline-block backdrop-blur-sm border-2 border-yellow-300">
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
                       <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto"><IconSparkles className="text-ny-blue w-10 h-10" /></div>
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