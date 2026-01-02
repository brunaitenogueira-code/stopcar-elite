
import React, { useState, useEffect, useCallback } from 'react';
import { initializeApp, getApps } from "firebase/app";
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  addDoc, 
  query, 
  onSnapshot, 
  orderBy, 
  getDocs,
  deleteDoc
} from "firebase/firestore";

// --- FIREBASE CONFIG ---
const firebaseConfig = {
    apiKey: "AIzaSyCYI7ew8ynN7mF-LDmBk2vuTIvwN_6YLJE",
    authDomain: "stopcar-20a1e.firebaseapp.com",
    projectId: "stopcar-20a1e",
    storageBucket: "stopcar-20a1e.firebasestorage.app",
    messagingSenderId: "1086047971188",
    appId: "1:1086047971188:web:0feeea35f6b67999686e21"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);

// --- TYPES ---
interface HistoricoItem {
  data: string;
  servico: string;
  status: string;
  foto?: string; // Legado para compatibilidade
  fotos?: string[]; // Novo campo para múltiplas fotos
}

interface VeiculoData {
  placa: string;
  cliente: string;
  whats: string;
  statusAtual: string;
  historico: HistoricoItem[];
}

interface RetornoProgramado {
  id: string;
  placa: string;
  cliente: string;
  whats: string;
  tipo: string;
  vencimento: number;
  data_formatada: string;
}

interface Agendamento {
  id: string;
  nome: string;
  whats: string;
  placa: string;
  serv: string;
  timestamp: any;
}

interface Liberacao {
  id: string;
  nome: string;
  whats: string;
  placa: string;
  timestamp: any;
}

// --- APP COMPONENT ---
const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('inicio');
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  
  // Search Plate State
  const [searchPlaca, setSearchPlaca] = useState('');
  const [searchResult, setSearchResult] = useState<VeiculoData | null>(null);
  const [searchError, setSearchError] = useState(false);

  // Admin Form State
  const [admForm, setAdmForm] = useState({
    placa: '',
    cliente: '',
    whats: '',
    status: 'ORÇAMENTO',
    fotos: [] as string[],
    servico: ''
  });

  // Data States
  const [retornos, setRetornos] = useState<RetornoProgramado[]>([]);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [liberacoes, setLiberacoes] = useState<Liberacao[]>([]);

  // Modal State
  const [modal, setModal] = useState({ isOpen: false, title: '', desc: '' });

  // --- LOGIC ---
  
  useEffect(() => {
    const autoPreencherCliente = async () => {
      const placaFormatada = admForm.placa.toUpperCase().trim();
      if (placaFormatada.length >= 7) {
        try {
          const docRef = doc(db, "veiculos", placaFormatada);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            setAdmForm(prev => ({
              ...prev,
              cliente: data.cliente || prev.cliente,
              whats: data.whats || prev.whats,
              status: data.statusAtual || prev.status
            }));
          }
        } catch (e) {
          console.error("Erro ao buscar dados automáticos:", e);
        }
      }
    };
    autoPreencherCliente();
  }, [admForm.placa]);

  const identificarServicos = (texto: string) => {
    const desc = texto.toLowerCase();
    const agendamentos: any[] = [];
    const regras = [
      { chave: "óleo", nome: "TROCA DE ÓLEO", meses: 6 },
      { chave: "oleo", nome: "TROCA DE ÓLEO", meses: 6 },
      { chave: "transmissão", nome: "FLUIDO TRANSMISSÃO", meses: 24 },
      { chave: "transmissao", nome: "FLUIDO TRANSMISSÃO", meses: 24 },
      { chave: "câmbio", nome: "REVISÃO CÂMBIO", meses: 24 },
      { chave: "cambio", nome: "REVISÃO CÂMBIO", meses: 24 },
      { chave: "correia", nome: "CORREIA DENTADA", meses: 24 },
      { chave: "revisão", nome: "REVISÃO GERAL", meses: 12 },
      { chave: "revisao", nome: "REVISÃO GERAL", meses: 12 }
    ];
    regras.forEach(r => {
      if (desc.includes(r.chave)) {
        const d = new Date();
        d.setMonth(d.getMonth() + r.meses);
        agendamentos.push({ servico: r.nome, data: d.getTime(), formatada: d.toLocaleDateString('pt-BR') });
      }
    });
    if (agendamentos.length === 0) {
      const d = new Date(); d.setMonth(d.getMonth() + 6);
      agendamentos.push({ servico: "RETORNO PREVENTIVO", data: d.getTime(), formatada: d.toLocaleDateString('pt-BR') });
    }
    return agendamentos;
  };

  const carregarLembretes = useCallback(async () => {
    try {
      const q = query(collection(db, "retornos_programados"), orderBy("vencimento", "asc"));
      const snap = await getDocs(q);
      const list: RetornoProgramado[] = [];
      snap.forEach(doc => list.push({ id: doc.id, ...doc.data() } as RetornoProgramado));
      setRetornos(list);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const buscarPlaca = async () => {
    if (!searchPlaca) return;
    const docSnap = await getDoc(doc(db, "veiculos", searchPlaca.toUpperCase().trim()));
    if (docSnap.exists()) {
      setSearchResult(docSnap.data() as VeiculoData);
      setSearchError(false);
    } else {
      setSearchResult(null);
      setSearchError(true);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 800;
            const MAX_HEIGHT = 800;
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }
            } else {
                if (height > MAX_HEIGHT) {
                    width *= MAX_HEIGHT / height;
                    height = MAX_HEIGHT;
                }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
            // Adiciona a nova foto ao array de fotos
            setAdmForm(prev => ({ ...prev, fotos: [...prev.fotos, dataUrl] }));
        };
        img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    // Limpa o valor do input para permitir tirar a mesma foto de novo se necessário
    e.target.value = '';
  };

  const removerFoto = (index: number) => {
    setAdmForm(prev => ({
      ...prev,
      fotos: prev.fotos.filter((_, i) => i !== index)
    }));
  };

  const salvarNoSistema = async () => {
    const { placa, cliente, whats, servico, status, fotos } = admForm;
    if (!placa || !cliente) return alert("Preencha ao menos Placa e Cliente!");
    
    try {
      const p = placa.toUpperCase().trim();
      const docRef = doc(db, "veiculos", p);
      const docSnap = await getDoc(docRef);
      
      const updateData: any = { 
        cliente, 
        whats, 
        placa: p, 
        statusAtual: status 
      };

      if (servico.trim()) {
        let hist = docSnap.exists() ? (docSnap.data().historico || []) : [];
        hist.unshift({ 
          data: new Date().toLocaleDateString('pt-BR'), 
          servico: servico.trim(), 
          status, 
          fotos: fotos // Salva o array de fotos
        });
        updateData.historico = hist;

        const listaRetornos = identificarServicos(servico);
        for (const item of listaRetornos) {
          await addDoc(collection(db, "retornos_programados"), {
            placa: p, cliente, whats, tipo: item.servico, vencimento: item.data, data_formatada: item.formatada
          });
        }
      }
      
      await setDoc(docRef, updateData, { merge: true });
      
      alert(servico.trim() ? "✅ Informações e histórico salvos com sucesso!" : "✅ Situação do veículo atualizada!");
      
      setAdmForm({ placa: '', servico: '', fotos: [], cliente: '', whats: '', status: 'ORÇAMENTO' });
      carregarLembretes();
    } catch (e) {
      console.error(e);
      alert("Erro ao salvar no banco de dados.");
    }
  };

  const realizarAgendamento = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as any;
    const n = form.ageNome.value;
    const p = form.agePlaca.value.toUpperCase();
    const s = form.ageServ.value;
    const w = form.ageWhats.value;
    
    await addDoc(collection(db, "agendamentos"), { nome: n, whats: w, placa: p, serv: s, timestamp: new Date() });
    window.open(`https://wa.me/5535991479464?text=Olá Bruno, sou ${n}. Quero orçar ${s} para o carro ${p}.`, '_blank');
  };

  const realizarLiberacao = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as any;
    const n = form.libNome.value;
    const p = form.libPlaca.value.toUpperCase();
    const w = form.libWhats.value;
    
    await addDoc(collection(db, "liberacoes"), { nome: n, whats: w, placa: p, timestamp: new Date() });
    window.open(`https://wa.me/5535991479464?text=Olá Bruno, sou ${n}. Estou LIBERANDO o orçamento para o veículo ${p}. Pode iniciar o serviço!`, '_blank');
    alert("✅ Liberação enviada com sucesso!");
    form.reset();
  };

  const liberarOrcamentoRapido = async (veiculo: VeiculoData) => {
    try {
      await addDoc(collection(db, "liberacoes"), { 
        nome: veiculo.cliente, 
        whats: veiculo.whats, 
        placa: veiculo.placa, 
        timestamp: new Date() 
      });
      window.open(`https://wa.me/5535991479464?text=Olá Bruno, sou ${veiculo.cliente}. Acabei de consultar meu veículo ${veiculo.placa} no site e estou LIBERANDO o orçamento. Pode seguir com o serviço!`, '_blank');
      alert("✅ Liberação enviada! Bruno foi notificado no sistema.");
    } catch (e) {
      alert("Erro ao enviar liberação.");
    }
  };

  const verificarSenha = () => {
    if (adminPassword === "1234") {
      setIsAdminLoggedIn(true);
      carregarLembretes();
    } else {
      alert("ACESSO NEGADO");
    }
  };

  // --- DELETE LOGIC ---
  const handleNotificarRetorno = async (id: string, whats: string, cliente: string) => {
    const link = `https://wa.me/55${whats.replace(/\D/g,'')}?text=Olá ${cliente}, aqui é o Bruno da StopCar...`;
    window.open(link, '_blank');
    try {
      await deleteDoc(doc(db, "retornos_programados", id));
      carregarLembretes();
    } catch (e) {
      console.error("Erro ao deletar retorno:", e);
    }
  };

  const handleResponderAgendamento = async (id: string, whats: string) => {
    const link = `https://wa.me/55${whats.replace(/\D/g,'')}`;
    window.open(link, '_blank');
    try {
      await deleteDoc(doc(db, "agendamentos", id));
    } catch (e) {
      console.error("Erro ao deletar agendamento:", e);
    }
  };

  const handleResponderLiberacao = async (id: string, whats: string) => {
    const link = `https://wa.me/55${whats.replace(/\D/g,'')}`;
    window.open(link, '_blank');
    try {
      await deleteDoc(doc(db, "liberacoes", id));
    } catch (e) {
      console.error("Erro ao deletar liberação:", e);
    }
  };

  useEffect(() => {
    const unsubAgend = onSnapshot(collection(db, "agendamentos"), (snap) => {
      const list: Agendamento[] = [];
      snap.forEach(doc => list.push({ id: doc.id, ...doc.data() } as Agendamento));
      setAgendamentos(list);
    });
    
    const unsubLib = onSnapshot(collection(db, "liberacoes"), (snap) => {
      const list: Liberacao[] = [];
      snap.forEach(doc => list.push({ id: doc.id, ...doc.data() } as Liberacao));
      setLiberacoes(list);
    });

    return () => {
      unsubAgend();
      unsubLib();
    };
  }, []);

  const openModal = (title: string, desc: string) => setModal({ isOpen: true, title, desc });
  const closeModal = () => setModal({ ...modal, isOpen: false });

  // --- RENDER ---
  return (
    <div className="min-h-screen bg-gray-100 font-sans">
      {/* HEADER */}
      <header className="bg-white shadow-xl sticky top-0 z-50 border-b-4 border-stopcar">
        <div className="container mx-auto px-4 py-3 flex flex-col items-center">
          <img 
            src="https://i.postimg.cc/52s5GFyb/unnamed.jpg" 
            className="h-14 cursor-pointer" 
            alt="Logo StopCar" 
            onClick={() => setActiveTab('inicio')} 
          />
          <nav className="flex space-x-3 text-[9px] font-black uppercase text-stopcar mt-3 no-scrollbar overflow-x-auto w-full justify-center">
            {['inicio', 'servicos', 'placa', 'padrao', 'agendamento', 'oficina', 'adm'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`tab-link py-2 px-2 whitespace-nowrap ${activeTab === tab ? 'active-tab' : ''} ${tab === 'agendamento' ? 'text-red-600' : ''} ${tab === 'oficina' ? 'bg-stopcar text-white px-3 rounded-lg !border-none' : ''}`}
              >
                {tab === 'agendamento' ? 'Orçamento' : tab === 'oficina' ? 'Oficina Elite' : tab === 'adm' ? 'ADM Site' : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* CONTENT */}
      <main className="container mx-auto p-4 max-w-6xl mt-4">
        
        {/* INICIO */}
        {activeTab === 'inicio' && (
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-[30px] shadow-2xl overflow-hidden flex flex-col md:flex-row border border-gray-100">
              <img src="https://i.postimg.cc/k4TdRsXZ/96c170b8-1489-43c6-9223-5a70d720cfec.jpg" className="w-full md:w-1/2 object-cover min-h-[350px]" alt="Bruno Nogueira" />
              <div className="p-8 flex flex-col justify-center bg-white text-center md:text-left w-full">
                <h1 className="text-3xl font-black text-stopcar uppercase italic leading-none">Bruno Nogueira</h1>
                <p className="text-red-600 font-bold text-[10px] uppercase tracking-[3px] mt-2 mb-6 italic">Especialista em Transmissões</p>
                <div className="grid grid-cols-2 gap-3">
                  <a href="https://wa.me/5535991479464" target="_blank" rel="noreferrer" className="bg-green-600 text-white p-3 rounded-xl flex flex-col items-center gap-1 shadow-md hover:scale-105 transition">
                    <i className="fab fa-whatsapp text-xl"></i><span className="font-black uppercase text-[8px] italic">WhatsApp</span>
                  </a>
                  <a href="https://instagram.com/stopcarautomaticos" target="_blank" rel="noreferrer" className="bg-gradient-to-r from-purple-600 to-pink-500 text-white p-3 rounded-xl flex flex-col items-center gap-1 shadow-md hover:scale-105 transition">
                    <i className="fab fa-instagram text-xl"></i><span className="font-black uppercase text-[8px] italic">Instagram</span>
                  </a>
                  <a href="https://www.youtube.com/@StopCarCentroAutomotivo" target="_blank" rel="noreferrer" className="bg-red-600 text-white p-3 rounded-xl flex flex-col items-center gap-1 shadow-md hover:scale-105 transition">
                    <i className="fab fa-youtube text-xl"></i><span className="font-black uppercase text-[8px] italic">YouTube</span>
                  </a>
                  <a href="https://www.google.com/maps?q=StopCar+Passos+MG" target="_blank" rel="noreferrer" className="bg-blue-700 text-white p-3 rounded-xl flex flex-col items-center gap-1 shadow-md hover:scale-105 transition">
                    <i className="fas fa-map-marker-alt text-xl"></i><span className="font-black uppercase text-[8px] italic">Maps</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* OFICINA ELITE */}
        {activeTab === 'oficina' && (
          <div className="light-theme text-center py-20">
            <h2 className="text-2xl font-black text-stopcar uppercase italic mb-4">Módulo Oficina Elite</h2>
            <p className="text-stopcar font-bold text-xs uppercase">Carregando interface exclusiva...</p>
          </div>
        )}

        {/* PADRAO */}
        {activeTab === 'padrao' && (
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl font-black text-stopcar text-center uppercase italic mb-8 italic">Padrão StopCar Elite</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { title: 'Scanner Nível 3', desc: 'Diagnóstico avançado de módulos.', img: 'https://i.postimg.cc/fbTVGHFB/ce52b189-2ea9-4d73-8678-bd871add1006.jpg', border: 'border-stopcar' },
                { title: 'Aperto Técnico', desc: 'Torque preciso seguindo manuais.', img: 'https://i.postimg.cc/2SYmJVJK/23827a04-9641-402f-80c3-9a82d187d966.jpg', border: 'border-red-600' },
                { title: 'Fluidos Premium', desc: 'Utilizamos Ravenol e Motul.', img: 'https://i.postimg.cc/bNxfQqJk/eb80928a-040f-4348-8d56-677a3f638ca6.jpg', border: 'border-stopcar' },
                { title: 'Selo Garantia', desc: 'Garantia Bruno Nogueira.', img: 'https://i.postimg.cc/cLR28hFF/fbe30a52-e2d3-4b60-903a-a8a299d8224c.jpg', border: 'border-red-600' }
              ].map((item, idx) => (
                <div key={idx} onClick={() => openModal(item.title, item.desc)} className={`cursor-pointer bg-white rounded-3xl shadow-xl overflow-hidden hover:scale-105 transition border-b-4 ${item.border}`}>
                  <img src={item.img} className="h-48 w-full object-cover" alt={item.title} />
                  <div className="p-4 text-center"><h3 className="font-black text-stopcar uppercase text-xs italic">{item.title}</h3></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SERVICOS */}
        {activeTab === 'servicos' && (
          <div className="max-w-5xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl shadow-lg border-t-4 border-stopcar text-center">
              <img src="https://i.postimg.cc/cLR28hFF/fbe30a52-e2d3-4b60-903a-a8a299d8224c.jpg" className="rounded-xl mb-3 h-32 w-full object-cover" alt="Cambio" />
              <h3 className="font-black text-stopcar uppercase text-[10px] italic">Câmbio Automático</h3>
            </div>
            <div className="bg-white p-4 rounded-2xl shadow-lg border-t-4 border-red-600 text-center">
              <img src="https://i.postimg.cc/bNxfQqJk/eb80928a-040f-4348-8d56-677a3f638ca6.jpg" className="rounded-xl mb-3 h-32 w-full object-cover" alt="Dialise" />
              <h3 className="font-black text-stopcar uppercase text-[10px] italic">Diálise Fluido</h3>
            </div>
            <div className="bg-white p-4 rounded-2xl shadow-lg border-t-4 border-stopcar text-center">
              <img src="https://i.postimg.cc/fbTVGHFB/ce52b189-2ea9-4d73-8678-bd871add1006.jpg" className="rounded-xl mb-3 h-32 w-full object-cover" alt="Injecao" />
              <h3 className="font-black text-stopcar uppercase text-[10px] italic">Injeção</h3>
            </div>
            <div className="bg-white p-4 rounded-2xl shadow-lg border-t-4 border-red-600 text-center">
              <img src="https://i.postimg.cc/2SYmJVJK/23827a04-9641-402f-80c3-9a82d187d966.jpg" className="rounded-xl mb-3 h-32 w-full object-cover" alt="Revisao" />
              <h3 className="font-black text-stopcar uppercase text-[10px] italic">Revisão</h3>
            </div>
          </div>
        )}

        {/* PLACA */}
        {activeTab === 'placa' && (
          <div className="max-w-md mx-auto text-center">
            <div className="bg-white p-6 rounded-[30px] shadow-2xl border-b-4 border-stopcar">
              <h2 className="text-sm font-black text-stopcar uppercase mb-4 italic">Histórico do Veículo</h2>
              <input 
                value={searchPlaca}
                onChange={(e) => setSearchPlaca(e.target.value)}
                placeholder="PLACA" 
                className="w-full p-4 bg-gray-50 rounded-2xl text-center text-3xl font-black uppercase mb-4 outline-none border-2 border-transparent focus:border-red-600 text-stopcar" 
              />
              <button onClick={buscarPlaca} className="w-full bg-stopcar text-white py-3 rounded-xl font-black uppercase text-xs shadow-md">CONSULTAR</button>
              
              <div className="mt-6 text-left">
                {searchResult && (
                  <>
                    <div className={`${searchResult.statusAtual === 'PRONTO' || searchResult.statusAtual === 'PRONTO PRA RETIRAR' ? 'bg-green-600' : 'bg-yellow-500'} text-white p-3 rounded-2xl text-center font-black mb-4 uppercase text-xs`}>
                      STATUS: {searchResult.statusAtual}
                    </div>

                    {searchResult.statusAtual === 'AGUARDANDO LIBERAÇÃO DO ORÇAMENTO' && (
                      <button 
                        onClick={() => liberarOrcamentoRapido(searchResult)}
                        className="w-full bg-purple-600 text-white py-4 rounded-2xl font-black uppercase text-xs shadow-xl mb-6 hover:scale-105 transition animate-pulse border-b-4 border-purple-800"
                      >
                        <i className="fas fa-check-circle mr-2"></i>
                        Liberar Orçamento Agora
                      </button>
                    )}

                    {searchResult.historico.map((h, i) => (
                      <div key={i} className="bg-white p-4 border-b border-x shadow-sm">
                        <small className="text-red-600 font-black">{h.data}</small>
                        <p className="text-stopcar text-[10px] font-bold mt-1 uppercase leading-tight">{h.servico}</p>
                        
                        {/* Exibe fotos salvas */}
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          {h.fotos ? h.fotos.map((img, imgIdx) => (
                            <img 
                              key={imgIdx}
                              src={img} 
                              className="w-full h-24 object-cover rounded-lg shadow-md cursor-pointer hover:opacity-80 transition" 
                              onClick={() => window.open(img, '_blank')} 
                              alt="Serviço"
                            />
                          )) : h.foto && (
                            <img 
                              src={h.foto} 
                              className="w-full h-auto col-span-2 rounded-lg shadow-md cursor-pointer" 
                              onClick={() => window.open(h.foto, '_blank')} 
                              alt="Serviço"
                            />
                          )}
                        </div>
                      </div>
                    ))}
                  </>
                )}
                {searchError && (
                  <p className="text-red-500 font-bold text-center text-[10px] uppercase">Não encontrado.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* AGENDAMENTO E LIBERAÇÃO */}
        {activeTab === 'agendamento' && (
          <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-[30px] shadow-2xl border-t-4 border-red-600 text-center">
              <h2 className="text-sm font-black text-stopcar uppercase mb-4 italic">Pedir Orçamento</h2>
              <form onSubmit={realizarAgendamento} className="space-y-3">
                <input name="ageNome" placeholder="Nome" className="w-full p-3 bg-gray-50 rounded-xl font-bold text-xs text-stopcar" required />
                <input name="ageWhats" type="tel" placeholder="WhatsApp" className="w-full p-3 bg-gray-50 rounded-xl font-bold text-xs text-stopcar" required />
                <input name="agePlaca" placeholder="Carro e Placa" className="w-full p-3 bg-gray-50 rounded-xl font-bold uppercase text-xs text-stopcar" required />
                <textarea name="ageServ" placeholder="O que o carro tem?" className="w-full p-3 bg-gray-50 rounded-xl font-bold text-xs text-stopcar" required></textarea>
                <button type="submit" className="w-full bg-red-600 text-white py-4 rounded-xl font-black uppercase text-xs shadow-md">Solicitar</button>
              </form>
            </div>

            <div className="bg-white p-6 rounded-[30px] shadow-2xl border-t-4 border-purple-600 text-center">
              <h2 className="text-sm font-black text-purple-600 uppercase mb-4 italic">Liberar Orçamento</h2>
              <form onSubmit={realizarLiberacao} className="space-y-3">
                <p className="text-[10px] text-gray-500 font-bold mb-4">Já recebeu o orçamento? Aprove aqui para iniciarmos!</p>
                <input name="libNome" placeholder="Seu Nome" className="w-full p-3 bg-gray-50 rounded-xl font-bold text-xs text-stopcar" required />
                <input name="libWhats" type="tel" placeholder="WhatsApp" className="w-full p-3 bg-gray-50 rounded-xl font-bold text-xs text-stopcar" required />
                <input name="libPlaca" placeholder="Placa do Carro" className="w-full p-3 bg-gray-50 rounded-xl font-bold uppercase text-xs text-stopcar" required />
                <button type="submit" className="w-full bg-purple-600 text-white py-4 rounded-xl font-black uppercase text-xs shadow-md">APROVAR E LIBERAR</button>
              </form>
            </div>
          </div>
        )}

        {/* ADM */}
        {activeTab === 'adm' && (
          <div className="max-w-full mx-auto">
            {!isAdminLoggedIn ? (
              <div className="bg-white p-8 rounded-[30px] shadow-xl max-w-xs mx-auto text-center border-t-4 border-stopcar">
                <h2 className="font-black uppercase mb-4 italic text-stopcar text-xs">Área Técnica</h2>
                <input 
                  type="password" 
                  placeholder="SENHA" 
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="w-full p-3 border rounded-xl text-center mb-4 text-xl font-black text-stopcar" 
                />
                <button onClick={verificarSenha} className="w-full bg-stopcar text-white py-3 rounded-xl font-black uppercase text-xs shadow-md">Acessar</button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid lg:grid-cols-4 gap-4">
                  {/* LANÇAR */}
                  <div className="bg-white p-5 rounded-2xl shadow-lg border-t-4 border-stopcar">
                    <h3 className="font-black text-stopcar mb-4 uppercase text-center text-[10px] italic">Lançar Serviço</h3>
                    <div className="space-y-2">
                      <label className="block text-[8px] font-black text-stopcar uppercase">Placa do Carro</label>
                      <input 
                        value={admForm.placa} 
                        onChange={(e) => setAdmForm({...admForm, placa: e.target.value})} 
                        placeholder="PLACA" 
                        className="w-full p-3 border rounded-xl font-black uppercase text-xs outline-none text-stopcar bg-yellow-50 focus:bg-white" 
                      />
                      
                      <label className="block text-[8px] font-black text-stopcar uppercase">Nome do Cliente</label>
                      <input 
                        value={admForm.cliente} 
                        onChange={(e) => setAdmForm({...admForm, cliente: e.target.value})} 
                        placeholder="CLIENTE" 
                        className="w-full p-3 border rounded-xl text-xs font-bold outline-none text-stopcar" 
                      />
                      
                      <label className="block text-[8px] font-black text-stopcar uppercase">WhatsApp do Cliente</label>
                      <input 
                        value={admForm.whats} 
                        onChange={(e) => setAdmForm({...admForm, whats: e.target.value})} 
                        placeholder="WHATSAPP DDD" 
                        className="w-full p-3 border rounded-xl text-xs font-bold outline-none text-stopcar" 
                      />
                      
                      <label className="block text-[8px] font-black text-stopcar uppercase">Status Atual</label>
                      <select value={admForm.status} onChange={(e) => setAdmForm({...admForm, status: e.target.value})} className="w-full p-3 border rounded-xl text-[10px] font-black uppercase text-stopcar">
                        <option value="ORÇAMENTO">ORÇAMENTO</option>
                        <option value="AGUARDANDO PEÇAS">AGUARDANDO PEÇAS</option>
                        <option value="AGUARDANDO LIBERAÇÃO DO ORÇAMENTO">AGUARDANDO LIBERAÇÃO DO ORÇAMENTO</option>
                        <option value="EM MANUTENÇÃO">EM MANUTENÇÃO</option>
                        <option value="PRONTO PRA RETIRAR">PRONTO PRA RETIRAR</option>
                      </select>
                      
                      <div className="pt-2">
                          <label className="block text-[8px] font-black text-stopcar mb-1 uppercase">Fotos das Peças / Serviço (Capturar várias)</label>
                          <div className="relative">
                              <input 
                                  type="file" 
                                  accept="image/*" 
                                  capture="environment"
                                  onChange={handleFileChange}
                                  className="w-full p-2 border-2 border-dashed border-stopcar rounded-xl text-[10px] font-black text-stopcar file:hidden cursor-pointer bg-white flex items-center justify-center text-center h-12"
                              />
                              <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-50">
                                <i className="fas fa-camera mr-2"></i> Adicionar Foto
                              </div>
                          </div>
                          
                          {/* LISTA DE FOTOS PARA LANÇAMENTO */}
                          {admForm.fotos.length > 0 && (
                            <div className="grid grid-cols-3 gap-2 mt-3 p-2 bg-gray-50 rounded-xl">
                              {admForm.fotos.map((foto, idx) => (
                                <div key={idx} className="relative group">
                                  <img src={foto} className="w-full h-16 object-cover rounded-lg border shadow-sm" alt={`Preview ${idx}`} />
                                  <button 
                                      onClick={() => removerFoto(idx)}
                                      className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full w-4 h-4 flex items-center justify-center shadow-lg"
                                  >
                                      <i className="fas fa-times text-[8px]"></i>
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                      </div>

                      <label className="block text-[8px] font-black text-stopcar uppercase">Descrição do Serviço (Opcional)</label>
                      <textarea value={admForm.servico} onChange={(e) => setAdmForm({...admForm, servico: e.target.value})} placeholder="O QUE FOI FEITO?" className="w-full p-3 border rounded-xl text-xs h-32 font-bold uppercase outline-none text-stopcar"></textarea>
                      <button onClick={salvarNoSistema} className="w-full bg-stopcar text-white py-4 rounded-xl font-black uppercase text-xs shadow-lg hover:scale-[1.02] transition">SALVAR TUDO</button>
                    </div>
                  </div>
                  
                  {/* RETORNOS */}
                  <div className="bg-white p-5 rounded-2xl shadow-lg border-t-4 border-red-600">
                    <h3 className="font-black text-stopcar mb-4 uppercase text-center text-[10px] italic">Retornos</h3>
                    <div className="max-h-[500px] overflow-y-auto no-scrollbar space-y-2">
                      {retornos.length > 0 ? retornos.map((r) => (
                        <div key={r.id} className="bg-white p-3 rounded-xl border-l-4 border-stopcar shadow-sm mb-2">
                          <p className="text-[10px] font-black text-stopcar uppercase">{r.cliente} ({r.placa})</p>
                          <p className="text-[10px] text-red-600 font-black">{r.tipo}</p>
                          <p className="text-[9px] text-gray-500 font-bold italic mb-2">Vence em: {r.data_formatada}</p>
                          <button onClick={() => handleNotificarRetorno(r.id, r.whats, r.cliente)} className="bg-green-600 text-white px-2 py-1 rounded text-[9px] font-black uppercase w-full">Notificar</button>
                        </div>
                      )) : <p className='text-[8px] text-gray-400 font-bold'>Sem retornos.</p>}
                    </div>
                  </div>

                  {/* AGENDAMENTOS */}
                  <div className="bg-white p-5 rounded-2xl shadow-lg border-t-4 border-green-600">
                    <h3 className="font-black text-stopcar mb-4 uppercase text-center text-[10px] italic">Orçamentos</h3>
                    <div className="max-h-[500px] overflow-y-auto no-scrollbar space-y-2">
                      {agendamentos.map((a) => (
                        <div key={a.id} className="bg-green-50 p-3 rounded-xl border-l-4 border-green-600 mb-2 shadow-sm">
                          <p className="text-[10px] font-black text-stopcar uppercase">{a.nome} ({a.placa})</p>
                          <p className="text-[9px] text-gray-600 mb-2 italic line-clamp-2">"{a.serv}"</p>
                          <button onClick={() => handleResponderAgendamento(a.id, a.whats)} className="text-green-700 font-black text-[9px] border border-green-600 rounded px-2 py-1 w-full uppercase">Responder</button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* LIBERAÇÕES */}
                  <div className="bg-white p-5 rounded-2xl shadow-lg border-t-4 border-purple-600">
                    <h3 className="font-black text-purple-600 mb-4 uppercase text-center text-[10px] italic">Liberações</h3>
                    <div className="max-h-[500px] overflow-y-auto no-scrollbar space-y-2">
                      {liberacoes.length > 0 ? liberacoes.map((l) => (
                        <div key={l.id} className="bg-purple-50 p-3 rounded-xl border-l-4 border-purple-600 mb-2 shadow-sm">
                          <div className="flex justify-between items-start mb-1">
                            <p className="text-[10px] font-black text-stopcar uppercase">{l.nome}</p>
                            <span className="bg-purple-600 text-white text-[7px] px-1 rounded">OK</span>
                          </div>
                          <p className="text-[11px] font-black text-purple-700 uppercase mb-2">PLACA: {l.placa}</p>
                          <button onClick={() => handleResponderLiberacao(l.id, l.whats)} className="bg-purple-600 text-white font-black text-[9px] rounded px-2 py-1 w-full uppercase">Visualizar</button>
                        </div>
                      )) : <p className='text-[8px] text-gray-400 font-bold'>Sem liberações pendentes.</p>}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* MODAL */}
      {modal.isOpen && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-[40px] max-w-sm w-full p-8 text-center relative border-t-8 border-stopcar">
            <button onClick={closeModal} className="absolute top-4 right-4 text-gray-400 hover:text-red-600"><i className="fas fa-times-circle text-2xl"></i></button>
            <h2 className="text-xl font-black text-stopcar uppercase italic mb-4">{modal.title}</h2>
            <p className="text-xs text-gray-600 font-bold leading-relaxed mb-6">{modal.desc}</p>
            <button onClick={closeModal} className="bg-stopcar text-white px-8 py-3 rounded-xl font-black uppercase text-[10px]">Entendi</button>
          </div>
        </div>
      )}

      {/* FOOTER NAVBAR */}
      <footer className="fixed bottom-0 w-full bg-white border-t p-2 md:hidden flex justify-around items-center text-stopcar">
         <button onClick={() => setActiveTab('inicio')} className={`flex flex-col items-center ${activeTab === 'inicio' ? 'text-red-600' : ''}`}>
           <i className="fas fa-home"></i><span className="text-[8px] font-bold">Início</span>
         </button>
         <button onClick={() => setActiveTab('placa')} className={`flex flex-col items-center ${activeTab === 'placa' ? 'text-red-600' : ''}`}>
           <i className="fas fa-search"></i><span className="text-[8px] font-bold">Placa</span>
         </button>
         <button onClick={() => setActiveTab('agendamento')} className={`flex flex-col items-center ${activeTab === 'agendamento' ? 'text-red-600' : ''}`}>
           <i className="fas fa-calendar-alt"></i><span className="text-[8px] font-bold">Orçar</span>
         </button>
         <button onClick={() => setActiveTab('adm')} className={`flex flex-col items-center ${activeTab === 'adm' ? 'text-red-600' : ''}`}>
           <i className="fas fa-user-cog"></i><span className="text-[8px] font-bold">ADM</span>
         </button>
      </footer>
    </div>
  );
};

export default App;
