import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, type User } from 'firebase/auth';
import { 
  getFirestore, collection, doc, setDoc, getDoc, 
  onSnapshot, updateDoc, getDocs, deleteDoc
} from 'firebase/firestore';
import { Gift, Smartphone, UserPlus, Trophy, PartyPopper, RefreshCw, Sparkles, Settings } from 'lucide-react';

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

// --- Component ---
export default function NewYearRaffle() {
  const [user, setUser] = useState<User | null>(null);
  const [mode, setMode] = useState<'register' | 'projector'>('register');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [myRegistration, setMyRegistration] = useState<Participant | null>(null);
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [slotName, setSlotName] = useState<string>("พร้อมสุ่ม");
  const [showConfetti, setShowConfetti] = useState<boolean>(false);
  const [winnerData, setWinnerData] = useState<Participant | null>(null);

  // Form State
  const [formData, setFormData] = useState<FormDataState>({ name: '', phone: '' });
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  // Admin/Settings
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(false);

  const handleAdminAccess = () => {
    if (isAdminAuthenticated) {
        setIsAdminAuthenticated(false);
        return;
    }
    // ⚠️ รหัสผ่านสำหรับผู้ดูแลระบบเริ่มต้นคือ nsru@2026 ⚠️
    // ⚠️ แนะนำให้เปลี่ยนรหัสผ่านนี้เพื่อความปลอดภัย ⚠️
    const pass = prompt("กรุณาใส่รหัสผ่านผู้ดูแลระบบ:");
    if (pass === "nsru@2026") {
        setIsAdminAuthenticated(true);
    } else if (pass) {
        alert("รหัสผ่านไม่ถูกต้อง!");
    }
  };

  // Refs

  // 1. Auth & Initial Setup
  useEffect(() => {
    const initAuth = async () => {
        try {
            await signInAnonymously(auth);
        } catch (error) {
            console.error("Auth Error", error);
        }
    };
    initAuth();
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
      
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
         setMyRegistration(docSnap.data() as Participant);
      } else {
         const newParticipant: Omit<Participant, 'id'> = {
           name: formData.name,
           phone: formData.phone,
           hasWon: false,
           timestamp: new Date().toISOString()
         };
         // ใน Firestore doc id คือ phone อยู่แล้ว
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
    const eligible = participants.filter(p => !p.hasWon);
    if (eligible.length === 0) {
      alert("ไม่มีผู้เข้าร่วมที่ยังไม่ได้รับรางวัลเหลือแล้ว!");
      return;
    }

    setIsSpinning(true);
    setWinnerData(null);
    setShowConfetti(false);

    // 1. Pick a winner beforehand
    const winner = eligible[Math.floor(Math.random() * eligible.length)];
    
    // 2. Animation logic with slowdown
    const totalSpins = 30; // How many name changes
    let currentSpin = 0;

    const spin = () => {
        currentSpin++;
        
        // Pick a random name to display, but not the winner unless it's the end
        let nameToShow;
        if (currentSpin === totalSpins) {
            nameToShow = winner.name;
        } else {
            const displayPool = eligible.filter(p => p.id !== winner.id);
            nameToShow = displayPool.length > 0 
                ? displayPool[Math.floor(Math.random() * displayPool.length)].name
                : winner.name; // Fallback if only one eligible person
        }
        setSlotName(nameToShow);

        if (currentSpin < totalSpins) {
            // As we get closer to the end, the timeout duration increases, slowing it down.
            const baseSpeed = 50; // ms
            const slowdownFactor = Math.pow(currentSpin / totalSpins, 2);
            const timeout = baseSpeed + (slowdownFactor * 150); // Adjust 150 to control slowdown rate
            setTimeout(spin, timeout);
        } else {
            // 3. Animation finished, set final winner
            setSlotName(winner.name);
            setWinnerData(winner);
            setIsSpinning(false);
            setShowConfetti(true);

            // 4. Update winner in Firestore
            const winnerRef = doc(db, 'artifacts', appId, 'public', 'data', 'participants', winner.id);
            updateDoc(winnerRef, { hasWon: true });
        }
    };

    spin();
  };

  const resetWinners = async () => {
    if (!window.confirm("คุณแน่ใจหรือไม่ที่จะรีเซ็ตสถานะผู้ชนะทั้งหมด?")) return;

    try {
        const querySnapshot = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'participants'));
        
        const updates = querySnapshot.docs.map(docSnap => {
            return updateDoc(docSnap.ref, { hasWon: false });
        });

        await Promise.all(updates);

        alert("รีเซ็ตสถานะผู้ชนะสำเร็จ!");
        window.location.reload();

    } catch (e: unknown) {
        if (e instanceof Error) {
            alert("รีเซ็ตไม่สำเร็จ: " + e.message);
        }
    }
  };

  const resetData = async () => {
    const pass = prompt("การกระทำนี้จะลบข้อมูลทั้งหมดและไม่สามารถย้อนกลับได้! \nกรุณาใส่รหัสผ่านผู้ดูแลระบบเพื่อยืนยัน:");
    if (pass !== "nsru@2026") {
        if (pass !== null) { // Don't show alert if user cancelled the prompt
            alert("รหัสผ่านไม่ถูกต้อง! การลบข้อมูลถูกยกเลิก");
        }
        return;
    }
    
    try {
        const querySnapshot = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'participants'));
        const deletePromises = querySnapshot.docs.map((docSnap) => deleteDoc(docSnap.ref));
        
        await Promise.all(deletePromises);

        setParticipants([]);
        setMyRegistration(null);
        setSlotName("พร้อมสุ่ม");
        localStorage.clear();
        alert("ลบข้อมูลทั้งหมดสำเร็จแล้ว");
        window.location.reload();
    } catch(e: unknown) {
        if (e instanceof Error) {
            alert("ลบข้อมูลไม่สำเร็จ: " + e.message);
        }
    }
  };

  // --- Views ---

  if (mode === 'projector') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-red-900 to-black text-white flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
        <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none">
             <div className="absolute top-10 left-10 text-6xl text-yellow-500 animate-pulse">✨</div>
             <div className="absolute bottom-20 right-20 text-8xl text-yellow-500 animate-bounce">🎁</div>
        </div>

        <div className="absolute top-4 right-4">
            <button onClick={handleAdminAccess} className="text-white/50 hover:text-white"><Settings size={22}/></button>
        </div>

        {isAdminAuthenticated && (
            <div className="absolute top-16 right-4 bg-gray-800/90 backdrop-blur-sm p-4 text-white text-sm rounded-lg shadow-lg z-20 w-64">
                 <h3 className="font-bold mb-3 border-b border-gray-600 pb-2">เมนูผู้ดูแล (Admin)</h3>
                 <div className="flex flex-col gap-2">
                     <button onClick={resetWinners} className="bg-yellow-600 py-2 rounded hover:bg-yellow-500 w-full text-center flex items-center justify-center gap-2">
                        <RefreshCw size={14}/> รีเซ็ตผู้ชนะ
                     </button>
                     <button onClick={resetData} className="bg-red-900 py-2 rounded hover:bg-red-800 w-full text-center flex items-center justify-center gap-2">
                         <RefreshCw size={14}/> ล้างข้อมูลทั้งหมด
                     </button>
                     <div className="h-px bg-gray-600 my-2"></div>
                     <button onClick={() => setMode('register')} className="bg-gray-600 py-2 rounded hover:bg-gray-500 w-full text-center flex items-center justify-center gap-1">
                        <Smartphone size={14}/> กลับไปหน้าลงทะเบียน
                    </button>
                 </div>
            </div>
        )}

        <div className="z-10 w-full max-w-4xl text-center">
          <h1 className="text-4xl md:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-yellow-100 to-yellow-500 mb-8 drop-shadow-lg">
            🎉 จับรางวัลปีใหม่ 2026 🎉
          </h1>

          <div className="bg-gradient-to-br from-yellow-600 to-yellow-800 p-4 rounded-3xl shadow-2xl border-4 border-yellow-400 mb-10 mx-auto max-w-2xl transform transition-transform hover:scale-105">
            <div className="bg-white rounded-xl overflow-hidden h-48 md:h-64 flex items-center justify-center border-b-8 border-gray-200 shadow-inner relative">
               <div className="absolute top-0 w-full h-8 bg-gradient-to-b from-black to-transparent opacity-30 z-10"></div>
               <div className="absolute bottom-0 w-full h-8 bg-gradient-to-t from-black to-transparent opacity-30 z-10"></div>

               <div className={`text-4xl md:text-7xl font-bold text-gray-800 tracking-wider transition-all duration-100 ${isSpinning ? 'blur-sm scale-110' : ''}`}>
                 {slotName}
               </div>
            </div>
            <div className="mt-4 flex justify-between items-center px-4">
                 <div className="text-yellow-200 font-semibold">ผู้เข้าร่วม: {participants.length} คน</div>
                 <div className="text-yellow-200 font-semibold">ผู้โชคดีแล้ว: {participants.filter(p=>p.hasWon).length} คน</div>
            </div>
          </div>

          <div className="flex gap-4 justify-center">
             <button 
               onClick={startSpin}
               disabled={isSpinning || participants.length === 0}
               className={`px-12 py-6 rounded-full text-2xl font-bold shadow-lg transition-all transform hover:-translate-y-1 active:translate-y-1
                 ${isSpinning 
                   ? 'bg-gray-500 cursor-not-allowed text-gray-300' 
                   : 'bg-gradient-to-b from-red-500 to-red-700 text-white border-b-4 border-red-900 hover:brightness-110'
                 }`}
             >
               {isSpinning ? 'กำลังหมุน...' : '🕹️ สุ่มรางวัล!'}
             </button>
          </div>
          
          {showConfetti && winnerData && !isSpinning && (
             <div className="mt-8 animate-bounce">
                <div className="text-2xl text-yellow-300 mb-2">✨ ขอแสดงความยินดีกับ ✨</div>
                <div className="text-5xl font-bold text-white bg-red-600/80 px-8 py-4 rounded-xl inline-block backdrop-blur-sm border-2 border-yellow-400">
                    {winnerData.name}
                </div>
                <div className="text-lg text-yellow-200 mt-2">เบอร์โทร: {winnerData.phone.substring(0, 3)}-xxxx-{winnerData.phone.substring(winnerData.phone.length - 3)}</div>
             </div>
          )}
        </div>
      </div>
    );
  }

  // 2. User Registration / Status View
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 font-sans text-slate-800">
      
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100">
        
        <div className="bg-red-600 p-6 text-center relative">
          <Gift className="w-12 h-12 text-yellow-300 mx-auto mb-2" />
          <h2 className="text-2xl font-bold text-white">ลงทะเบียนชิงโชคปีใหม่</h2>
          <p className="text-red-100 text-sm">New Year Party 2026</p>
        </div>

        <div className="p-8">
          {myRegistration ? (
            <div className="text-center space-y-6">
               
               {myRegistration.hasWon ? (
                   <div className="animate-pulse space-y-4 py-8">
                       <Trophy className="w-24 h-24 text-yellow-500 mx-auto drop-shadow-md" />
                       <h3 className="text-3xl font-bold text-red-600">ยินดีด้วย!!!</h3>
                       <p className="text-xl text-slate-700">คุณได้รับรางวัลแล้ว</p>
                       <div className="bg-yellow-100 text-yellow-800 px-4 py-2 rounded-lg inline-block border border-yellow-300">
                           คุณ {myRegistration.name}
                       </div>
                       <p className="text-sm text-gray-500 mt-4">กรุณาติดต่อรับรางวัลที่หน้าเวที</p>
                   </div>
               ) : (
                   <div className="space-y-4">
                       <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                           <Sparkles className="text-green-600 w-10 h-10" />
                       </div>
                       <h3 className="text-xl font-semibold text-green-700">ลงทะเบียนสำเร็จ!</h3>
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
              {error && (
                  <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center gap-2">
                      <span>⚠️</span> {error}
                  </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">ชื่อ - นามสกุล (หรือชื่อเล่น)</label>
                <div className="relative">
                    <UserPlus className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                    <input
                        type="text"
                        className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition"
                        placeholder="เช่น สมชาย ใจดี"
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        disabled={loading}
                    />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">เบอร์โทรศัพท์ (ใช้เป็น ID)</label>
                <div className="relative">
                    <Smartphone className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                    <input
                        type="tel"
                        className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition"
                        placeholder="08xxxxxxxx"
                        value={formData.phone}
                        onChange={(e) => setFormData({...formData, phone: e.target.value.replace(/\D/g,'')})}
                        maxLength={10}
                        disabled={loading}
                    />
                </div>
                <p className="text-xs text-gray-400 mt-1">* เบอร์โทรศัพท์ใช้เพื่อยืนยันตัวตนเท่านั้น</p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-lg shadow-lg transform active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                {loading ? 'กำลังบันทึก...' : 'ลงทะเบียนร่วมสนุก'} 
                {!loading && <PartyPopper size={18} />}
              </button>
            </form>
          )}
        </div>
        
        <div className="bg-gray-50 p-4 text-center text-xs text-gray-400 border-t border-gray-100">
           New Year Lucky Draw NSRU System © 2026
        </div>
      </div>
    </div>
  );
}