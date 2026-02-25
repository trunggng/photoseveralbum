import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc,
  getDoc,
  onSnapshot, 
  deleteDoc,
  serverTimestamp
} from 'firebase/firestore';
import { 
  Plus, 
  Trash2, 
  ChevronLeft, 
  Image as ImageIcon, 
  LogOut,
  X,
  Fingerprint,
  AlertCircle,
  Share2,
  Database,
  Server,
  Zap,
  Terminal,
  Wifi,
  Phone,
  User,
  Camera
} from 'lucide-react';

// --- CẤU HÌNH HỆ THỐNG FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyAkQWC958lFN7KSLpyTcKrA4XWV-JBksbU",
  authDomain: "godot4test-927a8.firebaseapp.com",
  databaseURL: "https://godot4test-927a8-default-rtdb.firebaseio.com",
  projectId: "godot4test-927a8",
  storageBucket: "godot4test-927a8.firebasestorage.app",
  messagingSenderId: "177381451974",
  appId: "1:177381451974:web:d7f92b4079759a515ecfc7",
  measurementId: "G-GY1WVZZJ38"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const GOOGLE_DRIVE_API_KEY = "AIzaSyB_cepnH6Yh9RnubdfndHSKrrCBPbof-4A";

export default function App() {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('auth'); 
  const [authError, setAuthError] = useState("");
  
  const [albums, setAlbums] = useState([]);
  const [currentAlbum, setCurrentAlbum] = useState(null);
  const [images, setImages] = useState([]);

  const [isRegister, setIsRegister] = useState(false);
  const [authForm, setAuthForm] = useState({ email: '', password: '' });
  
  const [newAlbum, setNewAlbum] = useState({ name: '', link: '', privacy: 'public', passcode: '' });
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [copySuccess, setCopySuccess] = useState(false);
  const [systemLogs, setSystemLogs] = useState(["BOOTING SYSTEM...", "CONNECTING TO DATA CORE..."]);

  // Hiệu ứng đèn LED chớp tắt
  const [signal, setSignal] = useState(true);
  useEffect(() => {
    const interval = setInterval(() => setSignal(s => !s), 800);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        setUser(null);
        const params = new URLSearchParams(window.location.search);
        if (!params.get('album')) {
          setLoading(false);
          setView('auth');
        }
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharedId = params.get('album');
    const ownerId = params.get('u');
    if (sharedId && ownerId) {
      setView('shared');
      loadSharedAlbum(ownerId, sharedId);
    }
  }, []);

  useEffect(() => {
    if (!user || view === 'shared') return;

    let unsubscribeAlbums = () => {};
    const syncUserData = async () => {
      setLoading(true);
      try {
        const userRef = doc(db, 'users', user.uid);
        const snap = await getDoc(userRef);

        let profileData;
        if (snap.exists()) {
          profileData = snap.data();
        } else {
          const randomId = Math.floor(100000 + Math.random() * 900000).toString();
          profileData = {
            email: user.email,
            checkId: randomId,
            createdAt: serverTimestamp()
          };
          await setDoc(userRef, profileData);
        }
        setUserProfile(profileData);

        const albumsRef = collection(db, 'users', user.uid, 'albums');
        unsubscribeAlbums = onSnapshot(albumsRef, (snapshot) => {
          const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setAlbums(data.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
        });

        setView('home');
      } catch (err) {
        setAuthError(err.message);
      } finally {
        setLoading(false);
      }
    };

    syncUserData();
    return () => unsubscribeAlbums();
  }, [user]);

  const loadSharedAlbum = async (ownerId, albumId) => {
    setLoading(true);
    try {
      const albumRef = doc(db, 'users', ownerId, 'albums', albumId);
      const snap = await getDoc(albumRef);
      if (snap.exists()) {
        const data = snap.data();
        setCurrentAlbum({ id: snap.id, ...data });
        if (data.privacy === 'public') fetchImages(data.folderId);
      }
    } catch (e) {} finally {
      setLoading(false);
    }
  };

  const fetchImages = async (folderId) => {
    setLoading(true);
    try {
      const folderIdClean = folderId.split('/').pop().split('?')[0];
      const response = await fetch(`https://www.googleapis.com/drive/v3/files?q='${folderIdClean}'+in+parents+and+mimeType+contains+'image/'&fields=files(id,name)&key=${GOOGLE_DRIVE_API_KEY}`);
      const data = await response.json();
      setImages(data.files || []);
    } catch (e) {} finally {
      setLoading(false);
    }
  };

  const handleCreateAlbum = async (e) => {
    e.preventDefault();
    if (!user) return;
    setIsSubmitting(true);
    try {
      const folderId = newAlbum.link.match(/[-\w]{25,}/)?.[0] || newAlbum.link;
      const albumData = {
        name: newAlbum.name,
        folderId: folderId,
        privacy: newAlbum.privacy,
        passcode: newAlbum.privacy === 'private' ? newAlbum.passcode : null,
        createdAt: serverTimestamp()
      };
      await setDoc(doc(collection(db, 'users', user.uid, 'albums')), albumData);
      setShowAddModal(false);
      setNewAlbum({ name: '', link: '', privacy: 'public', passcode: '' });
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAuthAction = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isRegister) {
        await createUserWithEmailAndPassword(auth, authForm.email, authForm.password);
      } else {
        await signInWithEmailAndPassword(auth, authForm.email, authForm.password);
      }
    } catch (err) {
      setAuthError(err.message);
      setLoading(false);
    }
  };

  const copyShareLink = (albumId) => {
    const url = `${window.location.origin}${window.location.pathname}?u=${user.uid}&album=${albumId}`;
    const tempInput = document.createElement("input");
    tempInput.value = url;
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand('copy');
    document.body.removeChild(tempInput);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  if (loading && view !== 'auth' && !currentAlbum) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a0c] text-blue-500 font-mono">
        <div className="relative mb-6">
          <Server className="animate-pulse" size={48} />
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full animate-ping"></div>
        </div>
        <div className="text-[10px] space-y-1 text-center opacity-70 uppercase tracking-widest">
          {systemLogs.map((log, i) => <p key={i}>{log}</p>)}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-zinc-300 font-mono selection:bg-blue-500/30 flex flex-col">
      
      {/* HEADER */}
      {user && view !== 'shared' && (
        <nav className="border-b border-zinc-800 bg-[#0d0d10] px-6 py-4 flex justify-between items-center sticky top-0 z-50">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600/10 border border-blue-500/30 rounded-lg text-blue-500">
                <Terminal size={20} />
              </div>
              <div>
                <h1 className="text-sm font-black tracking-tighter text-white uppercase">CloudID Console</h1>
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${signal ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-green-900'}`}></div>
                  <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-tighter">Secure Link Active</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="hidden md:flex flex-col items-end border-r border-zinc-800 pr-6">
              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Auth_Token</span>
              <div className="flex items-center gap-2 text-blue-400 font-black text-xs">
                #{userProfile?.checkId || "000000"}
              </div>
            </div>
            <button onClick={() => signOut(auth)} className="text-zinc-500 hover:text-red-500 transition-colors">
              <LogOut size={18} />
            </button>
          </div>
        </nav>
      )}

      {/* MAIN CONTENT */}
      <main className="flex-1">
        {/* AUTH VIEW */}
        {view === 'auth' && (
          <div className="min-h-[90vh] flex items-center justify-center p-6 relative">
            <div className="absolute inset-0 bg-[linear-gradient(rgba(18,18,20,0.8)_1px,transparent_1px),linear-gradient(90deg,rgba(18,18,20,0.8)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]"></div>
            
            <div className="w-full max-w-md relative">
              <div className="bg-[#0d0d10] border border-zinc-800 p-8 rounded-3xl shadow-2xl">
                <div className="text-center mb-8">
                  <Database className="mx-auto text-blue-500 mb-4" size={32} />
                  <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter">System.Access</h2>
                </div>

                <div className="flex border-b border-zinc-800 mb-8">
                  <button onClick={() => setIsRegister(false)} className={`flex-1 pb-4 text-[10px] font-black uppercase ${!isRegister ? 'text-blue-500 border-b-2 border-blue-500' : 'text-zinc-600'}`}>Login</button>
                  <button onClick={() => setIsRegister(true)} className={`flex-1 pb-4 text-[10px] font-black uppercase ${isRegister ? 'text-blue-500 border-b-2 border-blue-500' : 'text-zinc-600'}`}>Register</button>
                </div>

                {authError && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] font-bold uppercase">{authError}</div>}

                <form onSubmit={handleAuthAction} className="space-y-4">
                  <input required type="email" className="w-full bg-[#050506] border border-zinc-800 p-4 rounded-xl text-sm font-bold text-blue-400 outline-none focus:border-blue-500/50" placeholder="EMAIL ADDRESS" value={authForm.email} onChange={e => setAuthForm({...authForm, email: e.target.value})} />
                  <input required type="password" className="w-full bg-[#050506] border border-zinc-800 p-4 rounded-xl text-sm font-bold text-blue-400 outline-none focus:border-blue-500/50" placeholder="ACCESS KEY" value={authForm.password} onChange={e => setAuthForm({...authForm, password: e.target.value})} />
                  <button className="w-full bg-blue-600 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest text-white hover:bg-blue-500 transition-all">Initialize</button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* HOME VIEW */}
        {view === 'home' && user && (
          <div className="max-w-7xl mx-auto p-6 md:p-10 space-y-10">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 bg-[#0d0d10] p-8 rounded-3xl border border-zinc-800">
              <div>
                <div className="flex items-center gap-2 text-blue-500 mb-2">
                  <Terminal size={14} />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Storage Coordinator</span>
                </div>
                <h2 className="text-4xl font-black italic uppercase text-white leading-none">Clusters</h2>
              </div>
              <button onClick={() => setShowAddModal(true)} className="flex items-center gap-3 bg-white text-black px-6 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all">
                <Plus size={16} /> Add New Node
              </button>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {albums.map(album => (
                <div key={album.id} className="group bg-[#0d0d10] border border-zinc-800 rounded-2xl overflow-hidden hover:border-blue-500/40 transition-all duration-300">
                  <div className="p-6">
                    <div className="flex justify-between mb-6">
                      <div className="p-2 bg-zinc-900 rounded-lg text-blue-500">
                        <Database size={20} />
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => copyShareLink(album.id)} className="p-2 text-zinc-600 hover:text-blue-400"><Share2 size={16} /></button>
                        <button onClick={() => deleteDoc(doc(db, 'users', user.uid, 'albums', album.id))} className="p-2 text-zinc-600 hover:text-red-500"><Trash2 size={16} /></button>
                      </div>
                    </div>
                    <h3 className="text-white font-black uppercase italic text-lg truncate mb-4">{album.name}</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between text-[8px] font-bold uppercase text-zinc-600">
                        <span>Privacy</span>
                        <span className={album.privacy === 'public' ? 'text-green-500' : 'text-orange-500'}>{album.privacy}</span>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => { setCurrentAlbum(album); setView('detail'); fetchImages(album.folderId); }} className="w-full bg-zinc-900 border-t border-zinc-800 py-4 text-[9px] font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all">
                    Access Stream
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* DETAIL VIEW */}
        {view === 'detail' && (
          <div className="max-w-7xl mx-auto p-6 md:p-10 animate-in fade-in duration-500">
            <div className="flex items-center gap-6 mb-12">
              <button onClick={() => setView('home')} className="p-3 bg-[#0d0d10] border border-zinc-800 rounded-xl text-zinc-500 hover:text-white transition-all"><ChevronLeft size={20} /></button>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-2 h-2 rounded-full ${signal ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]' : 'bg-blue-900'}`}></div>
                  <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Stream Active</span>
                </div>
                <h2 className="text-4xl font-black text-white uppercase italic leading-none">{currentAlbum?.name}</h2>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {images.map(img => (
                <div key={img.id} className="aspect-square bg-[#0d0d10] border border-zinc-800 rounded-xl overflow-hidden group cursor-pointer relative shadow-lg">
                  <img 
                    src={`https://lh3.googleusercontent.com/d/${img.id}=s600`} 
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                    alt={img.name}
                  />
                  <div className="absolute inset-0 bg-blue-600/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <div className="absolute bottom-0 left-0 right-0 p-2 bg-black/60 translate-y-full group-hover:translate-y-0 transition-transform">
                    <p className="text-[8px] text-white truncate font-bold uppercase">{img.name}</p>
                  </div>
                </div>
              ))}
              {images.length === 0 && !loading && (
                <div className="col-span-full py-20 text-center border-2 border-dashed border-zinc-800 rounded-3xl">
                   <ImageIcon className="mx-auto text-zinc-700 mb-4" size={48} />
                   <p className="text-xs font-bold text-zinc-500 uppercase">No Data Found in Cluster</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* TÁC GIẢ & SIGNATURE */}
      <section className="mt-20 border-t border-zinc-800 bg-[#0d0d10] py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-2xl text-blue-500">
               <Camera size={24} />
            </div>
            <div>
              <h4 className="text-white font-black uppercase italic tracking-wider text-sm">Trungminer PhotoGarpher</h4>
              <div className="flex items-center gap-2 text-zinc-500 mt-1">
                <Phone size={12} className="text-blue-500" />
                <span className="text-[11px] font-bold tracking-widest">0943.120.069</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-center md:items-end gap-2">
            <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-[0.3em]">Built on Data-Core v4.2</p>
            <div className="flex items-center gap-3">
               <span className="text-[8px] text-zinc-700 uppercase">System Integrity</span>
               <div className="flex gap-1">
                 {[1,2,3,4,5].map(i => (
                   <div key={i} className={`w-1 h-3 rounded-full ${signal && i <= 3 ? 'bg-blue-500' : 'bg-zinc-800'}`}></div>
                 ))}
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER TIN HIỆU (LUÔN CỐ ĐỊNH) */}
      <footer className="sticky bottom-0 w-full bg-[#0d0d10]/95 backdrop-blur-md border-t border-zinc-800 px-6 py-2 flex justify-between items-center text-[8px] font-bold uppercase tracking-widest text-zinc-500 z-[90]">
         <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className={`w-1 h-1 rounded-full ${signal ? 'bg-blue-500 shadow-[0_0_5px_#3b82f6]' : 'bg-zinc-800'}`}></div>
              <span>Status: Online</span>
            </div>
            <div className="hidden sm:block">Uptime: 99.9%</div>
         </div>
         <div className="flex items-center gap-4">
           <div className="flex items-center gap-2">
             <Wifi size={10} className={signal ? 'text-blue-500' : 'text-zinc-700'} />
             <span>ID: {userProfile?.checkId || "GUEST"}</span>
           </div>
           <div className="text-blue-500 font-black">© 2024 TRUNGMINER</div>
         </div>
      </footer>

      {/* MODAL ADD */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/90 backdrop-blur-sm">
          <div className="bg-[#0d0d10] w-full max-w-lg rounded-2xl p-8 border border-zinc-800 relative">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-black text-white uppercase italic">Add.Data_Node</h2>
              <button onClick={() => setShowAddModal(false)} className="text-zinc-600 hover:text-white"><X /></button>
            </div>
            <form onSubmit={handleCreateAlbum} className="space-y-4">
              <input required type="text" className="w-full bg-[#050506] border border-zinc-800 p-4 rounded-xl text-white font-bold outline-none focus:border-blue-500/50" placeholder="CLUSTER NAME" value={newAlbum.name} onChange={e => setNewAlbum({...newAlbum, name: e.target.value})} />
              <input required type="text" className="w-full bg-[#050506] border border-zinc-800 p-4 rounded-xl text-white font-bold outline-none focus:border-blue-500/50" placeholder="GOOGLE DRIVE LINK" value={newAlbum.link} onChange={e => setNewAlbum({...newAlbum, link: e.target.value})} />
              <div className="flex gap-2">
                <button type="button" onClick={() => setNewAlbum({...newAlbum, privacy: 'public'})} className={`flex-1 py-3 text-[9px] font-black uppercase rounded-lg border ${newAlbum.privacy === 'public' ? 'bg-blue-600 border-blue-500' : 'border-zinc-800'}`}>Public</button>
                <button type="button" onClick={() => setNewAlbum({...newAlbum, privacy: 'private'})} className={`flex-1 py-3 text-[9px] font-black uppercase rounded-lg border ${newAlbum.privacy === 'private' ? 'bg-orange-600 border-orange-500' : 'border-zinc-800'}`}>Private</button>
              </div>
              <button className="w-full bg-blue-600 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest text-white mt-4 shadow-lg shadow-blue-500/20">Finalize</button>
            </form>
          </div>
        </div>
      )}

      {/* COPY NOTIFICATION */}
      {copySuccess && (
        <div className="fixed bottom-12 right-6 z-[100] animate-bounce">
          <div className="bg-blue-600 text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase shadow-xl border border-blue-400">
            Buffer_Link_Stored
          </div>
        </div>
      )}
    </div>
  );
}
