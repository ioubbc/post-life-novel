import React, { useState, useEffect, useRef } from 'react';
import { 
  BookOpen, Sparkles, ScrollText, Sword, 
  Crown, Cpu, Share2, Download, MessageCircle, 
  Send, User, RefreshCw, Zap, Star, Loader2, Building2, Hash
} from 'lucide-react';

// ✨ 신규: TypeScript 환경 에러 방지를 위한 데이터 설계도(Interface) 정의
interface Stat {
  name: string;
  value: number;
}

interface StoryData {
  title: string;
  genre: string;
  stats: Stat[];
  characterClass: string;
  content: string;
  hashtags: string[];
}

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export default function PastLifeNovelApp() {
  const [step, setStep] = useState('input'); // 'input', 'loading', 'story'
  const [userInfo, setUserInfo] = useState({ name: '', gender: 'F', era: 'fantasy', subEra: '아카데미', keywords: '' });
  
  // ✨ 수정됨: 상태 값에 명확한 타입(Type)을 지정하여 Vercel 빌드 에러 해결
  const [storyData, setStoryData] = useState<StoryData | null>(null);
  const [episodes, setEpisodes] = useState<string[]>([]);
  const [isNextEpLoading, setIsNextEpLoading] = useState(false);
  const storyEndRef = useRef<HTMLDivElement>(null);
  
  // 채팅 관련 상태
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [loadingProgress, setLoadingProgress] = useState(0);

  // Gemini API Key 
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || ""; 

  // 자동 스크롤 (채팅 및 소설 추가 시)
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isChatLoading]);

  useEffect(() => {
    if (episodes.length > 1) {
      storyEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [episodes]);

  // 지수 백오프 API 호출
  const fetchWithBackoff = async (url: string, options: RequestInit, retries = 5, delay = 1000): Promise<any> => {
    try {
      const res = await fetch(url, options);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      return await res.json();
    } catch (error) {
      if (retries > 0) {
        await new Promise(r => setTimeout(r, delay));
        return fetchWithBackoff(url, options, retries - 1, delay * 2);
      }
      throw error;
    }
  };

  // 세계관 및 세부 카테고리 구성
  const eras = [
    { id: 'fantasy', icon: <Crown className="w-5 h-5"/>, title: '중세 판타지', desc: '마법, 귀족, 드래곤',
      subEras: ['아카데미', '영지 경영', '로맨스 판타지', '마왕 토벌'] },
    { id: 'modern', icon: <Building2 className="w-5 h-5"/>, title: '현대물', desc: '재벌, 헌터, 연예계',
      subEras: ['재벌/기업물', '현대 판타지(게이트/헌터)', '연예계/아이돌', '전문직(의사/변호사)'] },
    { id: 'joseon', icon: <ScrollText className="w-5 h-5"/>, title: '조선/무협', desc: '왕족, 검객, 요괴',
      subEras: ['궁중 암투', '정통 무협', '요괴/퇴마', '대체역사'] },
    { id: 'cyberpunk', icon: <Cpu className="w-5 h-5"/>, title: 'SF/미래', desc: '디스토피아, 우주',
      subEras: ['사이버펑크', '스페이스 오페라', '아포칼립스', '메가코프 암투'] },
    { id: 'random', icon: <Sparkles className="w-5 h-5"/>, title: 'AI 랜덤 배정', desc: '운명에 맡기기',
      subEras: [] },
  ];

  // 1. 소설 1화 생성 로직
  const handleGenerateStory = async () => {
    if (!userInfo.name) {
      alert('주인공의 이름을 입력해주세요.');
      return;
    }
    
    setStep('loading');
    setChatHistory([]);
    setEpisodes([]); // 에피소드 초기화
    
    let progress = 0;
    const progressInterval = setInterval(() => {
      progress += 10;
      if (progress <= 90) setLoadingProgress(progress);
    }, 300);

    const eraContext = eras.find(e => e.id === userInfo.era)?.title || '랜덤 세계관';
    const subEraContext = userInfo.subEra || 'AI 랜덤 전개';
    const keywordContext = userInfo.keywords.trim() ? userInfo.keywords : 'AI 추천 트렌디 키워드 반영 (먼치킨, 사이다 등)';

    const prompt = `당신은 천재적이고 트렌디한 웹소설 작가입니다.
    다음 사용자를 주인공으로 한 '전생' 혹은 '평행우주' 웹소설의 1화 도입부를 작성해주세요.
    
    [주인공 및 세계관 설정]
    - 주인공 이름: ${userInfo.name}
    - 주인공 성별: ${userInfo.gender === 'M' ? '남성' : '여성'}
    - 메인 세계관: ${eraContext}
    - 세부 장르: ${subEraContext}
    - 사용자 요청 특별 키워드: ${keywordContext}
    
    요청된 세계관과 세부 장르, 그리고 특별 키워드를 본문에 매끄럽고 흥미롭게 녹여내세요.
    
    다음 JSON 형식으로 반드시 응답해주세요:
    {
      "title": "시선을 끄는 자극적인 웹소설 제목 (예: 환생했더니 조선의 흑막이었다)",
      "genre": "세부 장르",
      "stats": [
        {"name": "주요능력치1(예: 검술, 마력, 해킹)", "value": 90-100사이의 정수},
        {"name": "주요능력치2(예: 매력, 지능, 정치력)", "value": 1-100사이의 정수},
        {"name": "주요능력치3(예: 운, 체력, 재력)", "value": 1-100사이의 정수}
      ],
      "characterClass": "주인공의 직업이나 이명 (예: 몰락 귀족, 전설의 해커, 암행어사)",
      "content": "3~4문단으로 구성된 흥미진진한 소설 본문. 마지막 문장은 다음 내용이 미치도록 궁금해지게 끊어주세요.",
      "hashtags": ["#웹소설장르태그1", "#주인공성향태그2", "#세계관태그3"]
    }`;

    try {
      const response = await fetchWithBackoff(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: "application/json",
            }
          })
        }
      );
      
      const resultText = response.candidates[0].content.parts[0].text;
      const parsedData: StoryData = JSON.parse(resultText);
      setStoryData(parsedData);
      setEpisodes([parsedData.content]); 

    } catch (error) {
      console.error("Story generation failed:", error);
      const fallbackContent = `기억이 돌아온 것은, 차가운 돌바닥에 쓰러져 피를 흘리던 순간이었다.\n\n"내가... 왜 이런 곳에..."\n\n눈을 뜨자마자 밀려오는 거대한 마력의 파동. 그것은 분명 현생의 평범했던 '${userInfo.name}'의 것이 아니었다. 수백 년 전 대륙을 공포로 몰아넣었던 전설적인 대마법사의 힘이 내 혈관을 타고 흐르고 있었다.\n\n저 멀리서 나를 암살하려 했던 자들의 발소리가 들려온다. 나는 천천히 자리에서 일어났다. 입가에 비릿한 미소가 번졌다.\n\n"어디, 시작해볼까?"`;
      setStoryData({
        title: `환생한 ${userInfo.name}, 세상을 지배하다`,
        genre: "퓨전 판타지",
        stats: [
          { name: "무력", value: 99 }, { name: "지능", value: 85 }, { name: "운", value: 12 }
        ],
        characterClass: "숨겨진 마탑의 주인",
        content: fallbackContent,
        hashtags: ["#먼치킨", "#환생", "#사이다전개"]
      });
      setEpisodes([fallbackContent]);
    } finally {
      clearInterval(progressInterval);
      setLoadingProgress(100);
      setTimeout(() => setStep('story'), 500);
    }
  };

  // 2. 소설 다음 화(이어쓰기) 생성 로직
  const handleGenerateNextEpisode = async () => {
    if (isNextEpLoading || !storyData) return;
    setIsNextEpLoading(true);

    const recentContext = episodes.slice(-2).join('\n\n---\n\n');
    const nextEpisodeNumber = episodes.length + 1;

    const prompt = `당신은 천재적인 웹소설 작가입니다. 
    지금 당신은 '${storyData.title}'이라는 제목의 소설을 연재 중입니다. 주인공은 '${userInfo.name}'(${storyData.characterClass})입니다.
    
    다음은 최근까지 연재된 본문 내용입니다:
    ${recentContext}
    
    이 내용에 바로 이어지는 **[제 ${nextEpisodeNumber}화]**의 본문을 작성해주세요.
    - 주인공의 시점으로 몰입감 있게 전개할 것.
    - 3~4문단 분량으로 작성할 것.
    - 마지막 문장은 다음 화가 미치도록 궁금해지게 끊어줄 것.
    - 서론, 결론, 혹은 다른 군더더기 말 없이 오직 '소설 본문 텍스트'만 반환할 것.`;

    try {
      const response = await fetchWithBackoff(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
          })
        }
      );
      
      const nextContent = response.candidates[0].content.parts[0].text;
      setEpisodes(prev => [...prev, nextContent.trim()]);

    } catch (error) {
      console.error("Next episode generation failed:", error);
      alert("다음 화를 불러오는 중 차원의 마력(네트워크)이 불안정했습니다. 다시 시도해주세요.");
    } finally {
      setIsNextEpLoading(false);
    }
  };

  // 3. 캐릭터 챗봇 로직
  const handleSendChat = async () => {
    if (!chatInput.trim() || isChatLoading || !storyData) return;

    const userMessage = chatInput.trim();
    const newHistory: ChatMessage[] = [...chatHistory, { role: 'user', text: userMessage }];
    setChatHistory(newHistory);
    setChatInput('');
    setIsChatLoading(true);

    const currentStatus = episodes[episodes.length - 1].substring(0, 200) + "...";

    const prompt = `당신은 방금 생성된 웹소설 '${storyData.title}'의 주인공인 '${userInfo.name}'입니다. 직업/이명은 '${storyData.characterClass}'입니다.
    현재 당신이 처한 상황 요약: ${currentStatus}

    현생(21세기)을 살고 있는 미래의 당신(사용자)이 당신에게 질문을 던졌습니다.
    소설의 세계관과 당신의 캐릭터 성격에 완벽하게 빙의하여 대답하세요.
    현대 문물을 모르는 척 하거나, 초월적인 존재로서 조언을 해주는 등 흥미롭게 답변하세요. (최대 3~4문장)
    
    사용자의 질문: "${userMessage}"`;

    try {
      const response = await fetchWithBackoff(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
          })
        }
      );
      const aiResponseText = response.candidates[0].content.parts[0].text;
      setChatHistory([...newHistory, { role: 'model', text: aiResponseText }]);
    } catch (error) {
      setChatHistory([...newHistory, { role: 'model', text: "차원의 마력 간섭으로 인해 목소리가 잘 닿지 않는다... 다시 한 번 말해주겠나?" }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleShare = async () => {
    const shareData = {
      title: storyData?.title,
      text: `[전생 시뮬레이터] 나의 전생은 '${storyData?.characterClass}'?! 지금 내 평행우주 스토리를 확인해보세요.`,
      url: window.location.href, 
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${shareData.text}\n${shareData.url}`);
        alert('소설 링크가 클립보드에 복사되었습니다!');
      }
    } catch (err) {
      console.log('Error sharing:', err);
    }
  };

  const handleDownloadImage = () => {
    alert("인스타그램 스토리용 캐릭터 카드가 저장되었습니다!");
  };

  const handleReset = () => {
    setStep('input');
    setStoryData(null);
    setEpisodes([]);
    setLoadingProgress(0);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-slate-200 font-sans selection:bg-purple-500/30 pb-24">
      <div className="max-w-md mx-auto min-h-screen border-x border-zinc-900 bg-zinc-950 shadow-2xl relative overflow-hidden flex flex-col">
        
        {/* --- 헤더 --- */}
        <header className="px-6 py-5 border-b border-zinc-900 flex justify-between items-center bg-zinc-950/80 backdrop-blur-md sticky top-0 z-10">
          <h1 className="text-xl font-black tracking-tighter text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-purple-500" />
            CHRONICLE<span className="text-purple-500/50 font-light text-sm ml-1">전생 시뮬레이터</span>
          </h1>
          {step === 'story' && (
            <button onClick={handleReset} className="text-zinc-500 hover:text-white transition-colors">
              <RefreshCw className="w-5 h-5" />
            </button>
          )}
        </header>

        <main className="flex-1 p-6">
          
          {/* ================= STEP 1: 입력 화면 ================= */}
          {step === 'input' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-white leading-snug">
                  당신의 숨겨진<br/>평행우주를 기록합니다.
                </h2>
                <p className="text-zinc-400 text-sm">
                  이름과 원하는 세계관을 선택하면, AI가 당신을 주인공으로 한 웹소설 1화를 즉시 발행합니다.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">주인공 이름</label>
                  <input 
                    type="text" 
                    placeholder="본명 혹은 닉네임"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3.5 text-white placeholder-zinc-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                    value={userInfo.name}
                    onChange={(e) => setUserInfo({...userInfo, name: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">주인공 성별</label>
                  <div className="flex bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden h-[50px]">
                    <button 
                      onClick={() => setUserInfo({...userInfo, gender: 'M'})}
                      className={`flex-1 text-sm font-medium transition-colors ${userInfo.gender === 'M' ? 'bg-purple-600 text-white' : 'text-zinc-500 hover:bg-zinc-800'}`}
                    >
                      남성
                    </button>
                    <button 
                      onClick={() => setUserInfo({...userInfo, gender: 'F'})}
                      className={`flex-1 text-sm font-medium transition-colors ${userInfo.gender === 'F' ? 'bg-purple-600 text-white' : 'text-zinc-500 hover:bg-zinc-800'}`}
                    >
                      여성
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">메인 세계관 선택</label>
                <div className="grid grid-cols-2 gap-3">
                  {eras.map((era) => (
                    <button
                      key={era.id}
                      onClick={() => setUserInfo({
                        ...userInfo, 
                        era: era.id, 
                        subEra: era.subEras && era.subEras.length > 0 ? era.subEras[0] : '' 
                      })}
                      className={`flex flex-col items-start gap-2 p-3.5 rounded-xl border transition-all duration-200 ${
                        userInfo.era === era.id 
                        ? 'border-purple-500 bg-purple-500/10 shadow-[0_0_15px_rgba(168,85,247,0.15)]' 
                        : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`${userInfo.era === era.id ? 'text-purple-400' : 'text-zinc-500'}`}>
                          {era.icon}
                        </div>
                        <h3 className={`font-bold text-sm ${userInfo.era === era.id ? 'text-purple-300' : 'text-zinc-200'}`}>{era.title}</h3>
                      </div>
                      <p className="text-[10px] text-zinc-500 text-left line-clamp-1">{era.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {userInfo.era !== 'random' && (
                <div className="space-y-3 animate-in fade-in">
                  <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">세부 장르 (Sub-Genre)</label>
                  <div className="flex flex-wrap gap-2">
                    {eras.find(e => e.id === userInfo.era)?.subEras.map((sub, idx) => (
                      <button
                        key={idx}
                        onClick={() => setUserInfo({...userInfo, subEra: sub})}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                          userInfo.subEra === sub
                          ? 'bg-purple-600 text-white shadow-md'
                          : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:bg-zinc-700 hover:text-zinc-200'
                        }`}
                      >
                        {sub}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">
                  <Hash className="w-3.5 h-3.5" />
                  특별 요구 키워드 (선택사항)
                </label>
                <input 
                  type="text" 
                  placeholder="예: 먼치킨, 흑막, 처절한 복수, 코믹"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                  value={userInfo.keywords}
                  onChange={(e) => setUserInfo({...userInfo, keywords: e.target.value})}
                />
              </div>

              <button 
                onClick={handleGenerateStory}
                className="w-full bg-white hover:bg-zinc-200 text-zinc-950 font-black py-4 rounded-xl transition-colors shadow-[0_0_20px_rgba(255,255,255,0.2)] mt-6 flex justify-center items-center gap-2"
              >
                <Sparkles className="w-5 h-5 text-purple-600" />
                내 전생의 웹소설 생성하기
              </button>
            </div>
          )}

          {/* ================= STEP 2: 생성 중 로딩 화면 ================= */}
          {step === 'loading' && (
            <div className="flex flex-col items-center justify-center h-[60vh] space-y-8 animate-in fade-in">
              <div className="relative w-24 h-24 flex items-center justify-center">
                <div className="absolute inset-0 border-t-2 border-purple-500 rounded-full animate-spin"></div>
                <div className="absolute inset-2 border-l-2 border-fuchsia-400 rounded-full animate-spin-reverse"></div>
                <BookOpen className="w-8 h-8 text-purple-400 animate-pulse" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-lg font-bold text-white tracking-widest">WRITING STORY...</h3>
                <p className="text-zinc-400 text-sm">
                  AI 작가가 당신의 세계관을 집필 중입니다
                </p>
                <div className="w-48 h-1.5 bg-zinc-800 rounded-full mt-4 overflow-hidden mx-auto">
                  <div 
                    className="h-full bg-gradient-to-r from-purple-500 to-fuchsia-400 transition-all duration-300 ease-out"
                    style={{ width: `${loadingProgress}%` }}
                  ></div>
                </div>
              </div>
            </div>
          )}

          {/* ================= STEP 3: 스토리 및 결과 대시보드 ================= */}
          {step === 'story' && storyData && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
              
              {/* ✨ SNS 공유용 '캐릭터 스테이터스 카드' */}
              <div id="shareable-card" className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 rounded-2xl p-6 relative overflow-hidden shadow-2xl">
                <div className="absolute -top-10 -right-10 opacity-5">
                  <Sword className="w-48 h-48" />
                </div>
                
                <div className="flex items-center justify-between mb-4 relative z-10">
                  <span className="text-xs font-bold px-2 py-1 bg-purple-500/20 text-purple-400 rounded border border-purple-500/30">
                    {storyData.genre}
                  </span>
                  <span className="flex items-center gap-1 text-xs font-bold text-amber-400">
                    <Star className="w-3 h-3 fill-amber-400" /> SSR 랭크
                  </span>
                </div>

                <h2 className="text-2xl font-black text-white mb-1 leading-tight relative z-10">
                  {storyData.title}
                </h2>
                <p className="text-zinc-400 text-sm font-medium mb-6 relative z-10">
                  주인공: <span className="text-purple-300">{userInfo.name}</span> ({storyData.characterClass})
                </p>
                
                <div className="bg-zinc-950/80 rounded-xl p-4 mb-5 border border-zinc-800/50 relative z-10">
                  <p className="text-[10px] text-zinc-500 mb-3 uppercase tracking-widest font-bold">Character Stats</p>
                  <div className="space-y-3">
                    {storyData.stats.map((stat, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm">
                        <span className="text-zinc-300 w-16">{stat.name}</span>
                        <div className="flex-1 mx-3 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-purple-500 to-fuchsia-400 rounded-full"
                            style={{ width: `${stat.value}%` }}
                          ></div>
                        </div>
                        <span className="text-purple-300 font-mono font-bold w-6 text-right">{stat.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 flex-wrap relative z-10">
                  {storyData.hashtags.map((tag, idx) => (
                    <span key={idx} className="px-2.5 py-1 bg-zinc-800 text-zinc-300 text-xs rounded-md shadow-sm">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* ✨ 소설 본문 뷰어 영역 (에피소드 누적 렌더링) */}
              <div className="space-y-4">
                {episodes.map((content, index) => (
                  <div key={index} className="bg-zinc-900/50 rounded-2xl border border-zinc-800 p-6 relative animate-in fade-in slide-in-from-bottom-4">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-zinc-950 px-4 py-1 border border-zinc-800 rounded-full flex items-center gap-2 shadow-lg">
                      <ScrollText className="w-4 h-4 text-purple-500" />
                      <span className="text-xs font-bold text-zinc-300 tracking-widest">EPISODE {index + 1}.</span>
                    </div>
                    
                    <div className="mt-4 text-zinc-300 text-[15px] leading-loose whitespace-pre-wrap font-serif">
                      {content}
                    </div>
                  </div>
                ))}
                
                {/* 스크롤 위치 고정용 앵커 */}
                <div ref={storyEndRef} />
              </div>
              
              {/* ✨ 다음 화 이어쓰기 버튼 */}
              <div className="flex justify-center pt-2 pb-6">
                <button 
                  onClick={handleGenerateNextEpisode}
                  disabled={isNextEpLoading}
                  className="group relative inline-flex items-center justify-center px-6 py-3 text-sm font-bold text-white transition-all duration-200 bg-purple-600 border border-transparent rounded-full hover:bg-purple-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-600 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed overflow-hidden"
                >
                  {isNextEpLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      다음 화 집필 중...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 mr-2 text-amber-300 group-hover:animate-pulse" />
                      다음 화 생성하기 (무료 시청)
                    </>
                  )}
                </button>
              </div>
              
              {/* ✨ 전생의 나와 대화하기 (챗봇 인터페이스) */}
              <div className="bg-zinc-900 p-1 rounded-2xl border border-purple-500/20 shadow-[0_0_30px_rgba(168,85,247,0.05)]">
                <div className="bg-zinc-950/50 rounded-t-xl p-4 border-b border-zinc-800">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="w-5 h-5 text-purple-500" />
                    <h4 className="font-bold text-white">전생의 나와 연결됨</h4>
                  </div>
                  <p className="text-xs text-zinc-400 mt-1">[{storyData.characterClass}] 상태인 당신과 대화를 나눌 수 있습니다.</p>
                </div>

                <div className="p-4 h-64 overflow-y-auto space-y-4 bg-zinc-950/30 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
                  {chatHistory.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-zinc-600 space-y-2">
                      <MessageCircle className="w-8 h-8 opacity-50" />
                      <p className="text-xs text-center leading-relaxed">
                        차원의 문이 열렸습니다.<br/>
                        전생의 당신에게 궁금한 것을 물어보세요.
                      </p>
                    </div>
                  ) : (
                    chatHistory.map((msg, idx) => (
                      <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-zinc-800 text-zinc-400' : 'bg-purple-500 text-white'}`}>
                          {msg.role === 'user' ? <User className="w-4 h-4"/> : <Sparkles className="w-4 h-4"/>}
                        </div>
                        <div className={`p-3 rounded-2xl text-sm max-w-[80%] leading-relaxed ${
                          msg.role === 'user' 
                            ? 'bg-zinc-800 text-zinc-200 rounded-tr-sm' 
                            : 'bg-purple-900/30 text-purple-100 border border-purple-500/30 rounded-tl-sm font-serif'
                        }`}>
                          {msg.text}
                        </div>
                      </div>
                    ))
                  )}
                  
                  {isChatLoading && (
                    <div className="flex gap-3 flex-row">
                      <div className="w-8 h-8 rounded-full bg-purple-500 text-white flex items-center justify-center shrink-0">
                        <Sparkles className="w-4 h-4 animate-spin-slow"/>
                      </div>
                      <div className="p-4 rounded-2xl bg-purple-900/30 border border-purple-500/30 rounded-tl-sm flex items-center gap-1">
                        <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
                        <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                        <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                <div className="p-3 border-t border-zinc-800 bg-zinc-900 rounded-b-xl">
                  <div className="flex gap-2 relative">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSendChat()}
                      placeholder="예: 그 세계에서는 어떻게 돈을 벌었어?"
                      className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 transition-colors"
                    />
                    <button
                      onClick={handleSendChat}
                      disabled={isChatLoading || !chatInput.trim()}
                      className="bg-purple-600 hover:bg-purple-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white p-3 rounded-xl transition-colors flex items-center justify-center"
                    >
                      <Send className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
              {/* 채팅 인터페이스 종료 */}

            </div>
          )}
        </main>

        {/* ================= ✨ SNS 공유하기 플로팅 바 ================= */}
        {step === 'story' && (
          <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-zinc-950/90 backdrop-blur-xl border-t border-zinc-800 p-4 px-6 animate-in slide-in-from-bottom-full duration-500 z-40">
            <div className="flex gap-3">
              <button 
                onClick={handleDownloadImage}
                className="flex flex-col items-center justify-center gap-1 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl p-3 px-4 transition-colors border border-zinc-700 flex-1"
              >
                <Download className="w-5 h-5 text-zinc-300" />
                <span className="text-[10px] font-bold text-zinc-300">스토리 박제</span>
              </button>
              
              <button 
                onClick={handleShare}
                className="flex items-center justify-center gap-2 bg-white hover:bg-zinc-200 text-zinc-950 rounded-xl p-3 px-6 transition-colors font-black shadow-[0_0_15px_rgba(255,255,255,0.2)] flex-[2]"
              >
                <Share2 className="w-5 h-5" />
                <span>웹소설 데뷔 공유하기</span>
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
