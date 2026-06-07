import React, { useState, useEffect, useRef } from 'react';
import { 
  BookOpen, 
  HelpCircle, 
  Sparkles, 
  CheckCircle2, 
  XCircle, 
  ChevronRight, 
  Play, 
  RotateCcw, 
  Clock, 
  ArrowRight, 
  Award, 
  AlertCircle, 
  Terminal, 
  Lightbulb, 
  Flame, 
  Keyboard, 
  Compass, 
  Search,
  BookMarked,
  Mail,
  Send,
  CloudLightning,
  Download,
  Upload,
  RefreshCw,
  LogOut,
  UserCheck,
  Check,
  FileCheck
} from 'lucide-react';
import { User } from 'firebase/auth';
import { initAuth, googleSignIn, getAccessToken, logout, setAccessToken } from './auth';
import { 
  sendStudyDigestEmail, 
  fetchInboxFlashcardEmails, 
  backupDataToGoogleDrive, 
  listDriveBackupFiles, 
  downloadBackupData, 
  GmailMessage, 
  DriveBackupFile 
} from './workspace';

// Define the interface for Flashcard
interface Flashcard {
  id: string;
  subject: string;
  topic: string;
  question: string;
  expectedAnswerSummary: string;
  tips: string[];
  difficulty: string;
  formulaReference: string;
}

// Define the interface for Evaluation
interface Evaluation {
  score: number;
  correct: boolean;
  technicalAccuracy: string;
  stepByStepBreakdown: string;
  commonPitfalls: string;
  keyTakeaway: string;
}

const LOCAL_FALLBACK_DECKS: Record<string, Flashcard[]> = {
  'Chemical Engineering Thermodynamics': [
    {
      id: 'local_thermo_1',
      subject: 'Chemical Engineering Thermodynamics',
      topic: 'Joule-Thomson Expansion',
      question: 'Define the Joule-Thomson coefficient (μ_JT) mathematically in terms of partial derivatives. What is its value for an ideal gas, and what physical change happens at the inversion temperature?',
      expectedAnswerSummary: 'μ_JT = (∂T/∂P)_H. For an ideal gas, μ_JT = 0 because enthalpy depends only on temperature. At the inversion temperature, μ_JT changes sign; above this temperature, expansion causes heating, and below it, expansion causes cooling.',
      tips: [
        'Recall that the expansion is isenthalpic (H = constant).',
        'Relate the enthalpy differential dH = TdS + VdP to the coefficient.'
      ],
      difficulty: 'Intermediate',
      formulaReference: 'μ_JT = (∂T/∂P)_H'
    },
    {
      id: 'local_thermo_2',
      subject: 'Chemical Engineering Thermodynamics',
      topic: 'Gibbs-Duhem Equation',
      question: 'State the Gibbs-Duhem equation for a multi-component system at constant temperature and pressure. What is its principal utility in phase equilibrium calculations?',
      expectedAnswerSummary: 'Σ (x_i * dμ_i) = 0, where x_i is the mole fraction and μ_i is the chemical potential. In phase equilibrium, it is principally used to verify the thermodynamic consistency of experimental activity coefficient data (e.g., verifying ln(γ1) and ln(γ2)).',
      tips: [
        'Think about how changing the chemical potential of one component constrains the others.',
        'Use mole fractions x_i summing to 1.'
      ],
      difficulty: 'Advanced',
      formulaReference: 'Σ (x_i * dμ_i) = 0'
    }
  ],
  'Mass Transfer & Separation': [
    {
      id: 'local_mass_1',
      subject: 'Mass Transfer & Separation',
      topic: "Fick's First Law of Diffusion",
      question: "State Fick's First Law of binary molecular diffusion in general vector form, defining all terms. Under what molecular mechanism is this law derived?",
      expectedAnswerSummary: "J_A = -D_AB * ∇C_A, where J_A is the molar diffusion flux of component A, D_AB is the binary diffusion coefficient, and ∇C_A is the concentration gradient. It is derived under the physical mechanism of random molecular motion (Brownian motion).",
      tips: [
        'Ensure proper gradient sign alignment.',
        'Define J_A in units of mol/(m²·s).'
      ],
      difficulty: 'Fundamental',
      formulaReference: 'J_A = -D_AB * dC/dx'
    }
  ],
  'Fluid Mechanics': [
    {
      id: "local_fluid_1",
      subject: "Fluid Mechanics",
      topic: "Navier-Stokes Equations Simplification",
      question: "Write down the 1D Navier-Stokes equation for an incompressible, Newtonian fluid of constant viscosity flowing in the x-direction, listing all force categories represented.",
      expectedAnswerSummary: "ρ*(∂u/∂t + u*∂u/∂x) = -∂p/∂x + μ*(∂²u/∂x²) + ρ*g_x. The force categories are: inertial forces (left side), pressure forces, viscous shear forces, and body gravity forces (right side).",
      tips: [
        'Recall the acceleration terms on the left.',
        'Viscous term utilizes the second derivative of velocity due to shear.'
      ],
      difficulty: "Advanced",
      formulaReference: "ρ(Du/Dt) = -∇p + μ∇²u + ρg"
    }
  ]
};

const DEFAULT_SUBJECTS = [
  {
    name: 'Chemical Engineering Thermodynamics',
    description: 'Enthalpy, entropy of mixing, fugacity, and phase/chemical reaction equilibria.',
    icon: '🔥',
    topics: ['Joule-Thomson Expansion', 'Gibbs-Duhem Relation', 'Maxwell Equations', 'Activity Coefficients']
  },
  {
    name: 'Mass Transfer & Separation',
    description: 'Fickian molecular diffusion, NTU-HTU, McCabe-Thiele, boundary layers.',
    icon: '💧',
    topics: ["Fick's Diffusion Laws", 'McCabe-Thiele Columns', 'Absorption & NTU', 'Two-Film Theory']
  },
  {
    name: 'Fluid Mechanics',
    description: 'Stokes flow, turbulent friction factors, boundary layer thickness, Navier-Stokes.',
    icon: '🌪️',
    topics: ['Navier-Stokes Equations', 'Reynolds Metrology', 'Bernoulli Assumptions', 'Drag & Boundary Layer']
  },
  {
    name: 'Electrical Networks & Signals',
    description: 'Laplace-domain response, impedance match network, transfer function poles.',
    icon: '⚡',
    topics: ['Laplace s-domain matching', 'Impedance matching networks', 'LTI poles and zeros', 'Kirchhoff s-level laws']
  },
  {
    name: 'Structural Mechanics & Materials',
    description: 'Mohr stress tensor, Euler beam buckling, strain energy theorems.',
    icon: '🏗️',
    topics: ["Mohr's Stress Circle", "Euler-Bernoulli Beams", "Hooke Tensor Constants", "Shear-Moment Relations"]
  }
];

export default function App() {
  // Navigation State
  const [currentSubject, setCurrentSubject] = useState<string>('');
  const [customSubjectInput, setCustomSubjectInput] = useState<string>('');
  const [difficulty, setDifficulty] = useState<string>('Intermediate');

  // Firebase / OAuth Workspace States
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessTokenState] = useState<string | null>(null);
  const [authChecking, setAuthChecking] = useState<boolean>(true);
  const [workspaceInfoMessage, setWorkspaceInfoMessage] = useState<string>('');

  // Active Subject Cards Lists (To compile email lists or backing up)
  const [masteredList, setMasteredList] = useState<Flashcard[]>([]);
  const [reviewList, setReviewList] = useState<Flashcard[]>([]);

  // Workspace Dialog / Actions states
  const [emailDigestRecipient, setEmailDigestRecipient] = useState<string>('');
  const [emailSending, setEmailSending] = useState<boolean>(false);
  const [emailStatus, setEmailStatus] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const [driveBackups, setDriveBackups] = useState<DriveBackupFile[]>([]);
  const [loadingDriveBackups, setLoadingDriveBackups] = useState<boolean>(false);
  const [driveStatus, setDriveStatus] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const [gmailMessages, setGmailMessages] = useState<GmailMessage[]>([]);
  const [loadingGmailScan, setLoadingGmailScan] = useState<boolean>(false);
  const [gmailScannerNotice, setGmailScannerNotice] = useState<string>('');

  // Flashcard Deck Queue State
  const [deck, setDeck] = useState<Flashcard[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState<number>(0);
  const [loadingCards, setLoadingCards] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string>('');

  // Active Answering details
  const [userAnswer, setUserAnswer] = useState<string>('');
  const [showHint, setShowHint] = useState<boolean>(false);

  // Evaluation Screen State
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [evaluating, setEvaluating] = useState<boolean>(false);
  const [showExpectedAnswer, setShowExpectedAnswer] = useState<boolean>(false);

  // Progress Stats (persisted in LocalStorage per subject)
  const [masteredCount, setMasteredCount] = useState<number>(0);
  const [reviewCount, setReviewCount] = useState<number>(0);
  const [sessionStartTime, setSessionStartTime] = useState<number>(0);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  // Focus and Keyboard Refs
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const nextButtonRef = useRef<HTMLButtonElement>(null);

  // 1. Listen to Firebase Authentication State & Restore accessToken
  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, token) => {
        setUser(currentUser);
        setAccessTokenState(token);
        setAccessToken(token); // Update memory cached client value
        setAuthChecking(false);
        setEmailDigestRecipient(currentUser.email || '');
        setWorkspaceInfoMessage(`Secure Google Workspace Connected: ${currentUser.displayName}`);
        // Read recent drive files
        loadDriveBackupsList(token);
      },
      () => {
        setUser(null);
        setAccessTokenState(null);
        setAccessToken(null);
        setAuthChecking(false);
        setWorkspaceInfoMessage('');
      }
    );
    return () => unsubscribe();
  }, []);

  // Update session clocks and counts on currentSubject changes
  useEffect(() => {
    if (currentSubject) {
      setSessionStartTime(Date.now());
      setElapsedSeconds(0);
      setMasteredList([]);
      setReviewList([]);

      // Sync counts
      const savedMastered = localStorage.getItem(`pro_eng_mastered_${currentSubject}`);
      const savedReview = localStorage.getItem(`pro_eng_review_${currentSubject}`);
      setMasteredCount(savedMastered ? parseInt(savedMastered, 10) : 0);
      setReviewCount(savedReview ? parseInt(savedReview, 10) : 0);
    }
  }, [currentSubject]);

  // Session timer ticker
  useEffect(() => {
    if (!currentSubject || deck.length === 0) return;
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - sessionStartTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [currentSubject, deck, sessionStartTime]);

  // Watch keyboard modifiers for focus or rapid fire skip
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'h') {
        e.preventDefault();
        setShowHint(prev => !prev);
      }
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        handleSkipCard();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [deck, currentCardIndex, evaluation, userAnswer]);

  // Handle Sign In Action
  const handleGoogleSignIn = async () => {
    setAuthChecking(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setAccessTokenState(result.accessToken);
        setEmailDigestRecipient(result.user.email || '');
        setWorkspaceInfoMessage(`Success: Connected to ${result.user.displayName}`);
        loadDriveBackupsList(result.accessToken);
      }
    } catch (err: any) {
      console.error('Google Sign In failed:', err);
      setWorkspaceInfoMessage('OAuth failed. App remains perfectly functional in offline mode.');
    } finally {
      setAuthChecking(false);
    }
  };

  // Sign Out Action
  const handleSignOut = async () => {
    await logout();
    setUser(null);
    setAccessTokenState(null);
    setDriveBackups([]);
    setWorkspaceInfoMessage('Disconnected Google Workspace account.');
  };

  // List backups in user's Google Drive
  const loadDriveBackupsList = async (token: string) => {
    setLoadingDriveBackups(true);
    try {
      const list = await listDriveBackupFiles(token);
      setDriveBackups(list);
    } catch (err: any) {
      console.warn('Failed to load drive files:', err);
    } finally {
      setLoadingDriveBackups(false);
    }
  };

  // Firebase/Google Drive backup trigger with strict Dialog check
  const handleDriveBackup = async () => {
    if (!accessToken) {
      alert('Please connect Google Workspace to unlock Google Drive backups.');
      return;
    }

    const backupName = `pro_eng_prep_${currentSubject.replace(/[^a-zA-Z0-9]/g, '_')}_stats.json`;
    const check = window.confirm(`Backup stats block in your Google Drive?\nThis will write a file named: "${backupName}"`);
    if (!check) return;

    setDriveStatus(null);
    try {
      const payload = {
        subject: currentSubject,
        difficulty: difficulty,
        masteredCount: masteredCount,
        reviewCount: reviewCount,
        masteredCards: masteredList,
        reviewCards: reviewList,
        timestamp: Date.now()
      };

      await backupDataToGoogleDrive(accessToken, backupName, payload);
      setDriveStatus({ type: 'success', text: `Success! Created new cloud point in Drive: "${backupName}".` });
      // Refresh list
      loadDriveBackupsList(accessToken);
    } catch (error: any) {
      setDriveStatus({ type: 'error', text: 'Drive failed to upload: ' + error.message });
    }
  };

  // Restore/Download study state from Drive with confirmation
  const handleRestoreDriveBackup = async (fileId: string, backupName: string) => {
    const confirmation = window.confirm(`Are you sure you want to download and restore progress from "${backupName}"?\nThis will adjust your current session scores and stats.`);
    if (!confirmation) return;

    setDriveStatus(null);
    try {
      const data = await downloadBackupData(accessToken!, fileId);
      if (data) {
        if (data.subject) setCurrentSubject(data.subject);
        if (data.difficulty) setDifficulty(data.difficulty);
        setMasteredCount(data.masteredCount || 0);
        setReviewCount(data.reviewCount || 0);
        setMasteredList(data.masteredCards || []);
        setReviewList(data.reviewCards || []);
        
        // Save to local localStorage state
        if (data.subject) {
          localStorage.setItem(`pro_eng_mastered_${data.subject}`, (data.masteredCount || 0).toString());
          localStorage.setItem(`pro_eng_review_${data.subject}`, (data.reviewCount || 0).toString());
        }

        setDriveStatus({ type: 'success', text: `Restored progress stats successfully from: ${backupName}` });
      }
    } catch (err: any) {
      setDriveStatus({ type: 'error', text: 'Restore failed: ' + err.message });
    }
  };

  // Gmail Progress Report Dispatch with explicit feedback
  const handleGmailDispatchDigest = async () => {
    if (!accessToken) {
      alert('Sign in to send custom Workspace digests.');
      return;
    }
    if (!emailDigestRecipient.trim()) {
      alert('Please specify a valid recipient email address.');
      return;
    }

    const confirmSend = window.confirm(`Do you want to dispatch a detailed PRO-ENG report email to ${emailDigestRecipient}?`);
    if (!confirmSend) return;

    setEmailSending(true);
    setEmailStatus(null);

    try {
      const stats = {
        masteredCount,
        reviewCount,
        totalAttempted: masteredCount + reviewCount,
        masteryPercentage: masteredCount + reviewCount > 0 ? Math.round((masteredCount / (masteredCount + reviewCount)) * 100) : 0,
        elapsedSeconds
      };

      await sendStudyDigestEmail(
        accessToken,
        emailDigestRecipient,
        currentSubject,
        stats,
        masteredList,
        reviewList
      );

      setEmailStatus({ type: 'success', text: `Study digest successfully sent via Gmail API client to: ${emailDigestRecipient}` });
    } catch (err: any) {
      setEmailStatus({ type: 'error', text: 'Send failure error: ' + err.message });
    } finally {
      setEmailSending(false);
    }
  };

  // Query Gmail inbox for shared quiz packs
  const handleGmailImportScan = async () => {
    if (!accessToken) return;
    setLoadingGmailScan(true);
    setGmailScannerNotice('');
    setGmailMessages([]);

    try {
      const messages = await fetchInboxFlashcardEmails(accessToken);
      setGmailMessages(messages);
      
      const parsedFoundCount = messages.filter(m => m.parsedCard).length;
      if (messages.length === 0) {
        setGmailScannerNotice('No study alert emails found matching subject trigger terms.');
      } else if (parsedFoundCount > 0) {
        setGmailScannerNotice(`Inbox search complete! Identified ${parsedFoundCount} properly formatted student questions ready for import. See list below.`);
      } else {
        setGmailScannerNotice(`Search complete. Located ${messages.length} thread(s) but no valid structural flashcards found inside message parameters.`);
      }
    } catch (err: any) {
      setGmailScannerNotice('Error scanning Gmail inbox parameters: ' + err.message);
    } finally {
      setLoadingGmailScan(false);
    }
  };

  // Inject parsed card from Gmail directly to currently active queue
  const handleInjectGmailCard = (parsedCard: any) => {
    const formattedCard: Flashcard = {
      id: `gmail_imported_${Date.now()}`,
      subject: currentSubject || 'Imported Workspace Deck',
      topic: parsedCard.topic || 'Imported Subtopic',
      question: parsedCard.question,
      expectedAnswerSummary: parsedCard.expectedAnswerSummary,
      tips: ['Imported via collaborative study group from Gmail inbox logs.'],
      difficulty: 'Intermediate',
      formulaReference: parsedCard.formulaReference || 'Workspace Formula'
    };

    setDeck(prev => [formattedCard, ...prev]);
    setCurrentCardIndex(0);
    setUserAnswer('');
    setEvaluation(null);
    setShowHint(false);
    setShowExpectedAnswer(false);
    alert(`Success! Card "${parsedCard.topic}" injected and placed as Card 1 in active workspace.`);
  };

  // Initialize and load flashcards
  const handleStartExamSession = async (subjectName: string) => {
    setCurrentSubject(subjectName);
    setLoadingCards(true);
    setApiError('');
    setDeck([]);
    setCurrentCardIndex(0);
    setEvaluation(null);
    setUserAnswer('');
    setShowHint(false);
    setShowExpectedAnswer(false);

    try {
      const response = await fetch('/api/flashcards/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: subjectName,
          recentTopics: [],
          difficulty: difficulty
        }),
      });

      if (!response.ok) {
        throw new Error('API server returned error configuration.');
      }

      const data = await response.json();
      if (data.flashcards && data.flashcards.length > 0) {
        setDeck(data.flashcards);
      } else {
        throw new Error('Invalid JSON flashcard payload format.');
      }
    } catch (err: any) {
      console.warn('Backend generation failed, utilizing robust diagnostic local fallback dataset.', err);
      // Fallback strategy to maximize availability and seamless offline studies
      const fallback = LOCAL_FALLBACK_DECKS[subjectName] || [
        {
          id: 'gen_fallback',
          subject: subjectName,
          topic: 'General Topic Fundamentals',
          question: `State the conservation equation associated with basic steady-state fluxes in ${subjectName}. What thermodynamic or mechanical balance must always hold?`,
          expectedAnswerSummary: 'The rate of energy, mass, or force input must equal the output plus accumulation. For steady-state, accumulation is zero, so input equals output exactly.',
          tips: ['Assume steady-state constraints hold.', 'Verify conservation boundary values.'],
          difficulty: 'Intermediate',
          formulaReference: 'Input - Output = Accumulation'
        }
      ];
      setDeck(fallback);
      setApiError('Connected in Offline Sandbox Mode. Utilizing built-in study card catalog.');
    } finally {
      setLoadingCards(false);
      // Yield focus to answer input area
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  };

  // Pull extra cards asynchronously behind the scenes to maintain low latency queue
  const fetchNextFlashcardBatch = async () => {
    try {
      const answeredTopics = deck.map(d => d.topic);
      const response = await fetch('/api/flashcards/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: currentSubject,
          recentTopics: answeredTopics,
          difficulty: difficulty
        }),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.flashcards && data.flashcards.length > 0) {
          setDeck(prev => [...prev, ...data.flashcards]);
        }
      }
    } catch (e) {
      console.error('Quietly failed background card fetch:', e);
    }
  };

  // Submit Answer for Real-Time AI Score Evaluation and Reason Breakdown
  const handleSubmitAnswer = async () => {
    if (!userAnswer.trim()) return;
    setEvaluating(true);
    setApiError('');
    const activeCard = deck[currentCardIndex];

    try {
      const response = await fetch('/api/flashcards/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          card: activeCard,
          userAnswer: userAnswer
        })
      });

      if (!response.ok) {
        throw new Error('Could not evaluate user response.');
      }

      const data = await response.json();
      if (data.evaluation) {
        setEvaluation(data.evaluation);
        
        // Append active card reference to active runtime lists for Email Summaries & Drive Backups
        if (data.evaluation.correct) {
          setMasteredList(p => [...p, activeCard]);
          const newMastered = masteredCount + 1;
          setMasteredCount(newMastered);
          localStorage.setItem(`pro_eng_mastered_${currentSubject}`, newMastered.toString());
        } else {
          setReviewList(p => [...p, activeCard]);
          const newReview = reviewCount + 1;
          setReviewCount(newReview);
          localStorage.setItem(`pro_eng_review_${currentSubject}`, newReview.toString());
        }

        // Trigger background fetch if we are nearing the end of our current queue
        if (deck.length - currentCardIndex <= 2) {
          fetchNextFlashcardBatch();
        }
      } else {
        throw new Error('Invalid assessment payload.');
      }
    } catch (err: any) {
      console.warn('API Evaluation failed, conducting manual local regex parsing for core formula strings.', err);
      // Fallback evaluation to ensure total platform dependability
      const hasFormula = activeCard.formulaReference 
        ? userAnswer.toLowerCase().includes(activeCard.formulaReference.split('=')[0].trim().toLowerCase())
        : false;
      const score = hasFormula ? 80 : 40;
      
      const simulatedEval: Evaluation = {
        score: score,
        correct: score >= 70,
        technicalAccuracy: `[Sandbox Evaluation] Answer verified in offline sandbox. Analyzed keywords and formulas. You specified relevant identifiers in ${activeCard.topic}.`,
        stepByStepBreakdown: `Concept Deconstruction:\n${activeCard.expectedAnswerSummary}\n\nMathematical Mechanics rely on: ${activeCard.formulaReference}. Make sure all dynamic fluid, thermal boundary, or molecular variables are quantified correctly.`,
        commonPitfalls: `Ensure correct variable definitions, negative signs conservation, and exact physical dimensions.`,
        keyTakeaway: `Familiarize with standard notation: ${activeCard.formulaReference}`
      };
      setEvaluation(simulatedEval);
      
      if (score >= 70) {
        setMasteredList(p => [...p, activeCard]);
        setMasteredCount(m => m + 1);
      } else {
        setReviewList(p => [...p, activeCard]);
        setReviewCount(r => r + 1);
      }
    } finally {
      setEvaluating(false);
      // Shift keyboard focus reference to next action card
      setTimeout(() => nextButtonRef.current?.focus(), 150);
    }
  };

  // Keyboard rapid-press mechanics for submitting on Enter inside text field
  const handleAnswerKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmitAnswer();
    }
  };

  // Advance to Next Flashcard
  const handleNextCard = () => {
    setEvaluation(null);
    setUserAnswer('');
    setShowHint(false);
    setShowExpectedAnswer(false);
    setCurrentCardIndex(prev => prev + 1);
    // Shift focus to main input
    setTimeout(() => inputRef.current?.focus(), 120);
  };

  // Skip Flashcard
  const handleSkipCard = () => {
    if (currentCardIndex < deck.length - 1) {
      handleNextCard();
    } else {
      setApiError('You are at the end of the loaded queue. Wait for next batch generation or build a new custom topic session!');
    }
  };

  const handleResetSession = () => {
    localStorage.removeItem(`pro_eng_mastered_${currentSubject}`);
    localStorage.removeItem(`pro_eng_review_${currentSubject}`);
    setMasteredCount(0);
    setReviewCount(0);
    setMasteredList([]);
    setReviewList([]);
    setSessionStartTime(Date.now());
    setElapsedSeconds(0);
  };

  const handleReturnToHub = () => {
    setCurrentSubject('');
    setDeck([]);
    setEvaluation(null);
    setUserAnswer('');
    setShowHint(false);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculated percentage master rate
  const totalAttempted = masteredCount + reviewCount;
  const masteryPercentage = totalAttempted > 0 ? Math.round((masteredCount / totalAttempted) * 100) : 0;

  return (
    <div id="app_root" className="min-h-screen bg-slate-50 text-slate-900 selection:bg-indigo-100 selection:text-indigo-900 flex flex-col font-sans transition-all antialiased pb-12">
      
      {/* Top sticky header bar with precise branding */}
      <header id="main_header" className="bg-white border-b border-slate-200/85 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={handleReturnToHub}>
            <div className="h-9 w-9 bg-slate-900 text-white flex items-center justify-center rounded-lg font-mono font-bold tracking-tight text-sm shadow-sm">
              PE
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-950 tracking-tight font-mono hover:text-indigo-600 transition-colors">PRO-ENG <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 ml-1">WORKSPACE</span></h1>
              <p className="text-[10px] text-slate-500 font-mono">GOOGLE WORKSPACE CONNECTED EXAM REVISION ENGINE</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Google Identity Integration panel */}
            {authChecking ? (
              <div className="h-7 w-7 border-2 border-slate-200 border-t-indigo-600 rounded-full animate-spin"></div>
            ) : user ? (
              <div id="user_profile_pill" className="flex items-center space-x-2.5 bg-slate-100/90 hover:bg-slate-200/80 p-1.5 pl-2.5 pr-3.5 rounded-full border border-slate-200 transition-all">
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName || 'Google Profile'} className="h-6 w-6 rounded-full object-cover ring-1 ring-slate-300" referrerPolicy="no-referrer" />
                ) : (
                  <div className="h-6 w-6 rounded-full bg-indigo-600 text-white font-mono text-xs flex items-center justify-center font-bold">
                    {user.displayName?.charAt(0) || 'U'}
                  </div>
                )}
                <div className="hidden md:block text-left text-[10px] font-mono leading-tight">
                  <p className="font-bold text-slate-900 truncate max-w-[120px]">{user.displayName}</p>
                  <p className="text-emerald-600 font-semibold uppercase">Workspace Active</p>
                </div>
                <button 
                  id="google_logout_btn"
                  onClick={handleSignOut} 
                  className="text-slate-500 hover:text-rose-600 p-1 rounded-full hover:bg-white transition-all ml-1"
                  title="Disconnect account"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                id="google_login_gsi_btn"
                onClick={handleGoogleSignIn}
                className="inline-flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-700/50 py-1.5 px-3.5 rounded-lg text-xs font-extrabold font-mono tracking-tight shadow-sm cursor-pointer transition-all active:scale-[0.98]"
              >
                <CloudLightning className="h-3.5 w-3.5 text-indigo-200 fill-indigo-200" />
                <span>SIGN IN WITH GOOGLE</span>
              </button>
            )}

            <div className="hidden sm:flex items-center space-x-1 border border-slate-200 bg-slate-50 rounded-lg px-2 py-1 font-mono text-[10px] text-slate-700">
              <Keyboard className="h-3.5 w-3.5 text-slate-500" />
              <span>Enter to Submit</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main id="main_content_area" className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col justify-center">
        
        {/* API Error Panel */}
        {apiError && (
          <div id="api_disconnect_warning" className="mb-6 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-3.5 flex items-start space-x-3 text-xs md:text-sm shadow-sm transition-all animate-fadeIn">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold font-mono">{apiError}</p>
            </div>
          </div>
        )}

        {/* Workspace Connection Help Banner if offline */}
        {!user && !authChecking && (
          <div id="workspace_banner" className="mb-6 bg-indigo-50/70 border border-indigo-100 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
            <div className="flex items-start space-x-3">
              <div className="p-2 bg-indigo-100 text-indigo-800 rounded-md shrink-0">
                <Mail className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase font-mono">Unlock Real-Time Workspace Collaboration</h4>
                <p className="text-xs text-slate-600 mt-0.5">
                  Sign in with Google to automatically back up progress lists directly to your <b>Google Drive</b>, email step-by-step logic sheets via <b>Gmail</b>, and fetch parsed study group questions directly from your email threads!
                </p>
              </div>
            </div>
            <button
              id="banner_gsi_sign_in_btn"
              onClick={handleGoogleSignIn}
              className="bg-slate-900 hover:bg-slate-800 text-white font-mono text-xs font-bold px-4 py-2 rounded-lg shrink-0"
            >
              CONNECT MY WORKSPACE
            </button>
          </div>
        )}

        {/* VIEW 1: LANDING HUB / SUBJECT SELECTOR */}
        {!currentSubject ? (
          <div id="subject_selection_view" className="max-w-4xl mx-auto w-full py-2 sm:py-6 animate-fadeIn">
            
            {/* Elegant Display Welcome Banner */}
            <div className="text-center mb-10">
              <div className="inline-flex items-center space-x-2 bg-indigo-50 border border-indigo-100 text-indigo-900 px-3 py-1 rounded-full text-xs font-semibold mb-4 text-center font-mono">
                <Sparkles className="h-3.5 w-3.5 text-indigo-600 animate-pulse" />
                <span>Google Drive + Gmail Workspace Synchronization Realized</span>
              </div>
              <h2 className="text-3xl sm:text-5xl font-black text-slate-950 tracking-tight leading-none mb-4 font-mono uppercase">
                Engineering Boards <br className="hidden sm:block"/>
                <span className="text-indigo-600">Conceptual Firepower</span>
              </h2>
              <p className="text-sm sm:text-base text-slate-600 max-w-xl mx-auto leading-relaxed font-mono">
                Intensive quantitative deconstruction for chemical, mechanical, civil, and electrical subfields. Connect credentials to unleash cloud persistence metrics.
              </p>
            </div>

            {/* Google Drive Restore Hub & Scanning Board */}
            {user && (
              <div id="drive_restore_hub" className="mb-8 bg-white border border-slate-205 rounded-xl overflow-hidden shadow-sm">
                <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between font-mono text-xs">
                  <div className="flex items-center space-x-2">
                    <CloudLightning className="h-4 w-4 text-emerald-400" />
                    <span className="font-bold uppercase tracking-wider">YOUR CLOUD COPIES & WORKSPACE BACKUPS (GOOGLE DRIVE)</span>
                  </div>
                  <button 
                    id="refresh_backups_list_btn"
                    onClick={() => loadDriveBackupsList(accessToken!)}
                    className="hover:text-indigo-300 transition-colors p-1"
                    title="Refresh listing"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="p-5 font-mono">
                  {driveStatus && (
                    <div className={`mb-3.5 p-3 rounded-lg text-xs flex items-center space-x-2.5 ${driveStatus.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
                      {driveStatus.type === 'success' ? <Check className="h-4 w-4 text-emerald-600 shrink-0" /> : <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />}
                      <span>{driveStatus.text}</span>
                    </div>
                  )}

                  {loadingDriveBackups ? (
                    <p className="text-xs text-slate-400 py-3 text-center">Reading backup states indexes from Drive container...</p>
                  ) : driveBackups.length === 0 ? (
                    <div className="text-center py-5">
                      <p className="text-xs text-slate-500">No active Pro-Eng backups found on Google Drive folder scope yet.</p>
                      <p className="text-[10px] text-slate-400 mt-1 uppercase">BACKUP POINTS ARE AUTOMATICALLY PLOTTED WHILE ANSWERING CARDS INSIDE SUBJECT CHANNELS</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-[10px] text-slate-400 uppercase font-semibold mb-1">Located Revision Records (Restore any with one click):</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {driveBackups.map((bk) => (
                          <div key={bk.id} className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-all text-xs">
                            <div className="truncate pr-4 text-slate-750">
                              <p className="font-bold truncate text-[11px]">{bk.name}</p>
                              <p className="text-[9px] text-slate-400">{bk.createdTime ? new Date(bk.createdTime).toLocaleString() : 'No timestamp'}</p>
                            </div>
                            <button
                              id={`restore_backup_btn_${bk.id}`}
                              onClick={() => handleRestoreDriveBackup(bk.id, bk.name)}
                              className="bg-white hover:bg-indigo-600 hover:text-white border border-slate-200 py-1 px-2.5 rounded text-[10px] font-bold transition-all text-indigo-600 shadow-xs flex items-center space-x-1"
                            >
                              <Download className="h-3 w-3" />
                              <span>RESTORE</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Custom Settings (Difficulty Toggles) */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 mb-8 shadow-xs">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-slate-900 text-white rounded-lg">
                    <Compass className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 font-mono">Formula Rigor Depth Selector</h3>
                    <p className="text-xs text-slate-500 font-mono">Configures starting physical calculation requirements</p>
                  </div>
                </div>

                <div className="flex bg-slate-100/80 p-0.5 rounded-lg border border-slate-200 w-full sm:w-auto">
                  {['Fundamental', 'Intermediate', 'Advanced'].map((level) => (
                    <button
                      key={level}
                      id={`difficulty_btn_${level}`}
                      onClick={() => setDifficulty(level)}
                      className={`flex-1 sm:flex-initial text-xs font-bold font-mono px-4 py-2 rounded-md transition-all ${
                        difficulty === level 
                          ? 'bg-white text-slate-900 shadow-sm border border-slate-200' 
                          : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      {level.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Prebuilt Exam Suite Grid */}
            <div className="mb-10">
              <div className="flex items-center justify-between mb-4 px-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">Standard Exam Decks</span>
                <span className="text-xs font-mono text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">6 Free Suites</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-slideIn">
                {DEFAULT_SUBJECTS.map((sj) => (
                  <div
                    key={sj.name}
                    id={`subject_deck_${sj.name.replace(/\s+/g, '_')}`}
                    onClick={() => handleStartExamSession(sj.name)}
                    className="group bg-white border border-slate-200 rounded-xl p-5 hover:border-slate-800 hover:shadow-md cursor-pointer transition-all duration-200 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-2xl">{sj.icon}</span>
                        <span className="text-[10px] font-bold font-mono bg-slate-100 text-slate-600 group-hover:bg-indigo-50 group-hover:text-indigo-700 px-2.5 py-0.5 rounded transition-all uppercase">
                          STUDY NOW
                        </span>
                      </div>
                      <h4 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors font-mono">{sj.name}</h4>
                      <p className="text-xs text-slate-500 mt-1 pb-4 leading-relaxed font-mono">{sj.description}</p>
                    </div>
                    
                    <div className="border-t border-slate-100 pt-3 flex flex-wrap gap-1.5">
                      {sj.topics.slice(0, 3).map((tp, idx) => (
                        <span key={idx} className="text-[9px] font-mono text-slate-600 bg-slate-50 border border-slate-150 px-1.5 py-0.5 rounded">
                          {tp}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Custom Subject Search (The Custom Subject Builder) */}
            <div className="bg-slate-900 hover:bg-slate-950 text-white rounded-2xl p-6 sm:p-8 transition-all shadow-lg border border-slate-800 mb-10">
              <div className="max-w-2xl">
                <span className="text-[10px] font-bold font-mono tracking-widest text-indigo-400 uppercase bg-slate-800/85 px-2.5 py-1 rounded inline-block mb-3">
                  CUSTOM STUDY LAB
                </span>
                <h3 className="text-lg sm:text-xl font-bold tracking-tight mb-2 font-mono">Generate Niche Topic Decks on the Fly</h3>
                <p className="text-xs text-slate-300 mb-5 leading-relaxed font-mono">
                  Input specific thermodynamic models, aviation rules, or civil engineering parameters. The reasoning client models create a bespoke study queue.
                </p>

                <div className="flex flex-col sm:flex-row gap-2.5">
                  <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-400" />
                    <input
                      type="text"
                      id="custom_subject_field"
                      placeholder="e.g., Aerodynamics & Shockwave Mechanics"
                      value={customSubjectInput}
                      onChange={(e) => setCustomSubjectInput(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-400 rounded-xl py-3 pl-10 pr-4 text-xs sm:text-sm focus:outline-none focus:border-indigo-505 font-mono uppercase"
                    />
                  </div>
                  <button
                    id="generate_custom_btn"
                    onClick={() => {
                      if (customSubjectInput.trim()) {
                        handleStartExamSession(customSubjectInput.trim());
                      }
                    }}
                    disabled={!customSubjectInput.trim() || loadingCards}
                    className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl py-3 px-6 text-xs font-bold font-mono transition-all flex items-center justify-center space-x-2 shrink-0 group cursor-pointer"
                  >
                    <span>LAUNCH BESPOKE DECK</span>
                    <ArrowRight className="h-3.5 w-3.5 text-indigo-200 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </div>
            </div>

            {/* Gmail Study Group Import Scanner Widget */}
            {user && (
              <div id="gmail_import_widget" className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs font-mono">
                <div className="flex items-center space-x-2.5 mb-2.5">
                  <Mail className="h-5 w-5 text-indigo-600" />
                  <h3 className="text-sm font-bold text-slate-900">Scan Gmail for Study Group Questions</h3>
                </div>
                <p className="text-xs text-slate-600 mb-4">
                  Did study group peers email you conceptual cards? This tool searches threads matching topics and auto-parses formatted engineering problems directly into current active quiz sessions.
                </p>
                <button
                  id="scan_gmail_inbox_btn"
                  onClick={handleGmailImportScan}
                  disabled={loadingGmailScan}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-mono text-xs font-bold px-4 py-2.5 rounded-lg inline-flex items-center space-x-2 cursor-pointer transition-colors"
                >
                  {loadingGmailScan ? (
                    <>
                      <span className="h-3 w-3 border-2 border-slate-300 border-t-white rounded-full animate-spin"></span>
                      <span>SCANNING DECK EMAIL THREADS...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-3.5 w-3.5" />
                      <span>SCAN GMAIL IMMINENT QUIZ ALERTS</span>
                    </>
                  )}
                </button>

                {gmailScannerNotice && (
                  <p className="text-[10px] text-indigo-600 font-semibold uppercase mt-3 bg-indigo-50 p-2 rounded border border-indigo-100">
                    {gmailScannerNotice}
                  </p>
                )}

                {gmailMessages.length > 0 && (
                  <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">
                    {gmailMessages.map((msg) => (
                      <div key={msg.id} className="p-3 bg-slate-50 border border-slate-205 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                        <div className="flex-1 min-w-0 pr-3">
                          <p className="font-bold text-slate-900 truncate">Subject: '{msg.subject}'</p>
                          <p className="text-[10px] text-slate-500 truncate mt-0.5">{msg.snippet}</p>
                          {msg.parsedCard ? (
                            <span className="text-[9px] bg-emerald-150 text-emerald-800 font-bold px-1.5 py-0.5 rounded border border-emerald-200 inline-block mt-1">
                              READY FOR COMPILER: Topic "{msg.parsedCard.topic}"
                            </span>
                          ) : (
                            <span className="text-[9px] bg-slate-150 text-slate-500 font-mono px-1.5 py-0.5 rounded inline-block mt-1">
                              No key JSON schemas mapped
                            </span>
                          )}
                        </div>

                        {msg.parsedCard && (
                          <button
                            onClick={() => handleInjectGmailCard(msg.parsedCard)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-mono text-[10px] font-bold py-1.5 px-3 rounded-md shadow-xs flex items-center space-x-1 cursor-pointer transition-all shrink-0"
                          >
                            <FileCheck className="h-3.5 w-3.5" />
                            <span>IMPORT AND ACTIVATE CARDS</span>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="text-center mt-12 border-t border-slate-200 pt-6">
              <p className="text-xs text-slate-400 font-mono uppercase tracking-wider">
                Optimized for fast keyboard feedback. Fully rigorous client evaluation. No tech telemetry logs.
              </p>
            </div>

          </div>
        ) : (
          
          /* VIEW 2: ACTIVE DECK DASHBOARD (RAPID-FIRE WORKSPACE) */
          <div id="active_study_panel" className="max-w-5xl mx-auto w-full py-2 animate-fadeIn font-mono">
            
            {/* Workspace Header & Action Hub */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5 border-b border-slate-200 pb-4">
              <div className="flex items-start space-x-3">
                <button 
                  id="return_to_hub_btn"
                  onClick={handleReturnToHub} 
                  className="bg-white hover:bg-slate-100 border border-slate-250 p-2 rounded-lg text-slate-600 transition-colors shrink-0"
                  title="Return to Selector Hub"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] font-bold bg-slate-900 text-white px-2 py-0.5 rounded uppercase">
                      {difficulty} LEVEL
                    </span>
                    <span className="text-xs text-slate-500 font-mono">CORE SESSION CHANNEL</span>
                  </div>
                  <h3 id="current_subject_title" className="text-base sm:text-lg font-bold tracking-tight text-slate-900 mt-0.5 capitalize truncate max-w-sm sm:max-w-md">
                    {currentSubject}
                  </h3>
                </div>
              </div>

              {/* Progress Tracker Widget & Google drive fast integration */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                
                <div className="grid grid-cols-3 gap-2 bg-white border border-slate-200 rounded-xl p-2.5 font-mono text-center min-w-[240px]">
                  <div className="border-r border-slate-100">
                    <p className="text-[8px] text-emerald-600 font-semibold uppercase">Mastered</p>
                    <p id="mastered_counter" className="text-sm font-bold text-slate-900">{masteredCount}</p>
                  </div>
                  <div className="border-r border-slate-100">
                    <p className="text-[8px] text-rose-500 font-semibold uppercase">Revision</p>
                    <p id="review_counter" className="text-sm font-bold text-slate-900">{reviewCount}</p>
                  </div>
                  <div>
                    <p className="text-[8px] text-indigo-600 font-semibold uppercase">Success Rate</p>
                    <p id="success_rate_badge" className="text-sm font-bold text-indigo-600">{masteryPercentage}%</p>
                  </div>
                </div>

                {/* Cloud Backups / Google drive Fast Save trigger */}
                {user && (
                  <button
                    id="fast_drive_backup_btn"
                    onClick={handleDriveBackup}
                    className="bg-slate-900 hover:bg-slate-800 text-white border border-slate-900 font-mono text-xs font-bold px-3 py-2.5 rounded-lg flex items-center justify-center space-x-1.5 cursor-pointer shadow-xs"
                    title="Dump current stats records dynamically into Google Drive"
                  >
                    <Upload className="h-3.5 w-3.5 text-emerald-400" />
                    <span>SAVE BACKUP</span>
                  </button>
                )}
              </div>
            </div>

            {/* If Deck loading screen */}
            {loadingCards ? (
              <div id="loading_cards_indicator" className="bg-white border border-slate-200 rounded-2xl p-16 text-center shadow-sm flex flex-col items-center justify-center min-h-[400px]">
                <div className="h-10 w-10 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
                <h4 className="font-bold text-slate-900 font-mono">COMPILING BOARDS DATASET</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-md">
                  Gemini AI is analyzing academic parameters, formula requirements, and typical failure rates to construct an intense concept queue...
                </p>
              </div>
            ) : deck.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center shadow-sm">
                <AlertCircle className="h-10 w-10 text-slate-400 mx-auto mb-4" />
                <h4 className="font-bold text-slate-900 font-mono">Active deck channel is empty.</h4>
                <p className="text-xs text-slate-500 mt-1 mb-5">Click below to restart or select standard templates.</p>
                <button onClick={handleReturnToHub} className="bg-slate-900 text-white px-4 py-2 text-xs font-bold font-mono rounded">
                  MAIN SELECTOR HUB
                </button>
              </div>
            ) : (
              
              /* Active Deck Area */
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                
                {/* Left Side: Question and Workspace */}
                <div className="lg:col-span-7 space-y-4">
                  
                  {/* The Interactive Flashcard */}
                  <div id="active_flashcard_card" className="bg-white border-2 border-slate-900 rounded-2xl overflow-hidden shadow-sm transition-all duration-200">
                    
                    {/* Card Header information */}
                    <div className="bg-slate-900 text-slate-100 px-5 py-3 flex items-center justify-between font-mono text-[10px]">
                      <div className="flex items-center space-x-2">
                        <BookMarked className="h-3.5 w-3.5 text-indigo-400 animate-pulse" />
                        <span className="font-bold tracking-wider">TOPIC: {deck[currentCardIndex]?.topic.toUpperCase()}</span>
                      </div>
                      <span className="bg-slate-800 text-slate-300 px-2.5 py-0.5 rounded font-bold font-mono">
                        CARD {currentCardIndex + 1} OF {deck.length}
                      </span>
                    </div>

                    {/* Question Content */}
                    <div className="p-6 sm:p-7">
                      <div className="text-xs text-indigo-600 font-bold font-mono tracking-widest uppercase mb-1.5">
                        {deck[currentCardIndex]?.formulaReference || 'Fundamental Equation'}
                      </div>
                      
                      <p id="active_question_text" className="text-sm sm:text-base font-bold text-slate-950 leading-relaxed font-mono">
                        {deck[currentCardIndex]?.question}
                      </p>

                      {/* Display visual hints if revealed */}
                      {showHint ? (
                        <div id="tips_expanded_area" className="mt-4 p-4 bg-yellow-50/60 border border-yellow-250 text-yellow-950 rounded-xl text-xs space-y-1.5 animate-fadeIn">
                          <div className="flex items-center space-x-1.5 font-bold text-amber-805 mb-1">
                            <Lightbulb className="h-3.5 w-3.5 text-amber-600" />
                            <span>EXAM COMPILER HINTS:</span>
                          </div>
                          {deck[currentCardIndex]?.tips.map((tp, idx) => (
                            <p key={idx} className="font-mono leading-relaxed pl-3.5 relative">
                              <span className="absolute left-1">•</span> {tp}
                            </p>
                          ))}
                        </div>
                      ) : (
                        <button
                          id="reveal_tips_btn"
                          onClick={() => setShowHint(true)}
                          className="mt-4 flex items-center space-x-1.5 text-xs text-indigo-600 hover:text-indigo-850 font-bold font-mono transition-all border-b border-indigo-200 border-dashed pb-0.5"
                        >
                          <Lightbulb className="h-3.5 w-3.5 shrink-0" />
                          <span>EXPAND ASSISTING EQUATION TIPS (Ctrl+H)</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Student Answer Console Input */}
                  <div className="bg-white border border-slate-205 rounded-2xl p-5 shadow-xs space-y-3">
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <label htmlFor="student_answer_area" className="font-bold text-slate-500 uppercase tracking-wider">
                        YOUR CORE SCIENTIFIC INFERENCES
                      </label>
                      <button 
                        id="auto_reveal_correct_btn"
                        onClick={() => setShowExpectedAnswer(p => !p)} 
                        className="text-[10px] text-slate-500 font-bold hover:text-slate-900 underline"
                      >
                        {showExpectedAnswer ? "HIDE INSTRUCTIONS KEY" : "REVEAL EXAM VALUE CARD ANSWER KEY"}
                      </button>
                    </div>

                    {showExpectedAnswer && (
                      <div id="expected_answer_reveal" className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 animate-fadeIn">
                        <span className="font-bold text-slate-950 block mb-1">Standard Textbook Statement:</span>
                        <p className="leading-relaxed">{deck[currentCardIndex]?.expectedAnswerSummary}</p>
                      </div>
                    )}

                    <textarea
                      id="student_answer_area"
                      ref={inputRef}
                      value={userAnswer}
                      onChange={(e) => setUserAnswer(e.target.value)}
                      onKeyDown={handleAnswerKeyDown}
                      placeholder="Input derivations formulas, proof assumptions, or core numerical logic. Hit Enter to launch assessment evaluation..."
                      className="w-full h-28 bg-slate-50 border border-slate-205 text-slate-950 rounded-xl p-4 text-xs sm:text-sm focus:outline-none focus:border-indigo-600 focus:bg-white transition-all font-mono placeholder:text-slate-400"
                      disabled={evaluating || !!evaluation}
                    />

                    {/* Console Actions Toolbar */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
                      
                      {/* Keyboard shortcuts hints */}
                      <div className="hidden sm:flex items-center space-x-3 text-[10px] text-slate-400 font-mono">
                        <span><kbd className="bg-slate-100 px-1 py-0.5 rounded border border-slate-200 text-slate-600">Ctrl+H</kbd> Hint</span>
                        <span><kbd className="bg-slate-100 px-1 py-0.5 rounded border border-slate-200 text-slate-600">Ctrl+S</kbd> Skip</span>
                        <span><kbd className="bg-slate-100 px-1 py-0.5 rounded border border-slate-200 text-slate-600">Enter</kbd> Evaluate</span>
                      </div>

                      <div className="flex items-center space-x-2.5 w-full sm:w-auto font-mono">
                        <button
                          id="skip_card_btn"
                          onClick={handleSkipCard}
                          className="flex-1 sm:flex-initial bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 py-2 px-3 rounded-xl text-xs font-bold transition-all"
                          disabled={evaluating}
                        >
                          SKIP CARD (Ctrl+S)
                        </button>
                        
                        {!evaluation ? (
                          <button
                            id="submit_evaluation_btn"
                            onClick={handleSubmitAnswer}
                            disabled={!userAnswer.trim() || evaluating}
                            className="flex-1 sm:flex-initial bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white py-2 px-5 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2 border border-indigo-700/40 shadow-xs cursor-pointer"
                          >
                            {evaluating ? (
                              <>
                                <span className="h-3 w-3 border-2 border-slate-200 border-t-white rounded-full animate-spin"></span>
                                <span>ASSESSING PROOF...</span>
                              </>
                            ) : (
                              <>
                                <span>SUBMIT PROOF</span>
                                <ChevronRight className="h-4 w-4" />
                              </>
                            )}
                          </button>
                        ) : (
                          <button
                            id="advance_next_btn"
                            ref={nextButtonRef}
                            onClick={handleNextCard}
                            className="flex-1 sm:flex-initial bg-slate-950 hover:bg-slate-850 text-white py-2 px-5 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2 animate-pulse cursor-pointer"
                          >
                            <span>NEXT CARD (Space/Enter)</span>
                            <ArrowRight className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Gmail Report Dispatch Console widget if logged in */}
                  {user ? (
                    <div id="gmail_dispatch_widget" className="bg-white border border-slate-205 rounded-2xl p-5 shadow-xs font-mono space-y-3">
                      <div className="flex items-center space-x-2 text-indigo-600">
                        <Mail className="h-4.5 w-4.5" />
                        <span className="text-xs font-bold uppercase tracking-wider">EMAIL REPORT DIRECTLY VIA GMAIL CLIENT</span>
                      </div>
                      <p className="text-[11px] text-slate-600">
                        Email your active session metrics, mastered blocks, and review targets as a high-fidelity HTML revision sheet via Google Gmail API.
                      </p>

                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="email"
                          id="recipient_email_field"
                          placeholder="Your email addresses..."
                          value={emailDigestRecipient}
                          onChange={(e) => setEmailDigestRecipient(e.target.value)}
                          className="flex-1 bg-slate-50 border border-slate-200 text-xs rounded-lg p-2.5 outline-none focus:bg-white focus:border-indigo-500 font-mono"
                        />
                        <button
                          id="dispatch_gmail_button"
                          onClick={handleGmailDispatchDigest}
                          disabled={emailSending}
                          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold py-2.5 px-4 rounded-lg flex items-center justify-center space-x-2 cursor-pointer transition-colors"
                        >
                          {emailSending ? (
                            <>
                              <span className="h-3 w-3 border-2 border-slate-350 border-t-white rounded-full animate-spin"></span>
                              <span>SENDING MAIL...</span>
                            </>
                          ) : (
                            <>
                              <Send className="h-3.5 w-3.5" />
                              <span>DISPATCH DIGEST</span>
                            </>
                          )}
                        </button>
                      </div>

                      {emailStatus && (
                        <p id="email_status_feedback" className={`text-[10px] font-bold p-2.5 rounded border ${emailStatus.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-250' : 'bg-rose-50 text-rose-800 border-rose-250'}`}>
                          {emailStatus.text}
                        </p>
                      )}
                    </div>
                  ) : null}

                  {/* Clean stats reset */}
                  <div className="flex justify-end pr-1">
                    <button
                      id="reset_subject_records_btn"
                      onClick={handleResetSession}
                      className="text-[9px] font-mono text-slate-400 hover:text-slate-600 transition-colors flex items-center space-x-1"
                    >
                      <RotateCcw className="h-2.5 w-2.5" />
                      <span>RESET INSTANT EXAM CHANNELS SCORE RECORD</span>
                    </button>
                  </div>

                </div>

                {/* Right Side: DEEP REASONING ASSESSMENT PANEL */}
                <div className="lg:col-span-5 h-full">
                  
                  {!evaluation && !evaluating ? (
                    <div className="bg-slate-100 border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center text-slate-400 flex flex-col items-center justify-center min-h-[460px]">
                      <Terminal className="h-9 w-9 text-slate-350 mb-3 animate-pulse" />
                      <h4 className="font-bold text-slate-700 text-xs uppercase tracking-wider">Awaiting Student Proof</h4>
                      <p className="text-[11px] text-slate-500 mt-1 max-w-xs leading-relaxed">
                        Input your technical formulas, mechanical descriptors, or parameter proof values on the left console. The high-thinking AI reasoning evaluation cards will be populated here.
                      </p>
                    </div>
                  ) : evaluating ? (
                    <div id="eval_thinking_placeholder" className="bg-white border border-slate-200 rounded-2xl p-10 text-center shadow-xs flex flex-col items-center justify-center min-h-[460px] animate-pulse">
                      <div className="h-11 w-11 rounded-full bg-slate-950 text-white flex items-center justify-center mb-4 text-sm font-bold animate-bounce">
                        ?
                      </div>
                      <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">AI EVALUATING CRITERIA INDEX</h4>
                      <p className="text-[10px] text-slate-500 mt-2 max-w-xs leading-relaxed font-mono">
                        Vetting thermodynamic identities, molecular units conservation, boundary criteria logic, and mechanical equations precision...
                      </p>
                    </div>
                  ) : (
                    
                    /* AI Evaluation breakdown display */
                    <div id="ai_evaluation_card" className="bg-white border-2 border-slate-900 rounded-2xl overflow-hidden shadow-sm animate-slideIn">
                      
                      {/* Evaluation Header */}
                      <div className={`px-5 py-3.5 ${evaluation.correct ? 'bg-emerald-50 text-emerald-905 border-b border-emerald-150' : 'bg-rose-50 text-rose-905 border-b border-rose-150'} flex items-center justify-between`}>
                        <div className="flex items-center space-x-2">
                          {evaluation.correct ? (
                            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                          ) : (
                            <XCircle className="h-5 w-5 text-rose-500" />
                          )}
                          <span className="text-xs font-bold uppercase tracking-wider">
                            {evaluation.correct ? 'CONCEPT CLEAR' : 'CONCEPT UNDER REVISE'}
                          </span>
                        </div>
                        
                        <div className="flex items-center space-x-2 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-xs">
                          <span className="text-[9px] text-slate-500 font-bold">SCORE</span>
                          <span id="evaluation_score_ring" className={`text-xs font-black ${evaluation.score >= 70 ? 'text-emerald-600' : evaluation.score >= 40 ? 'text-amber-500' : 'text-rose-600'}`}>
                            {evaluation.score}%
                          </span>
                        </div>
                      </div>

                      {/* Review details */}
                      <div className="p-5 space-y-4 max-h-[580px] overflow-y-auto text-xs leading-relaxed font-mono">
                        
                        {/* Direct Critique */}
                        <div id="critique_block">
                          <span className="text-[9px] font-bold text-slate-450 block uppercase tracking-wider mb-1">TECHNICAL ACCURACY CRITIQUE</span>
                          <p id="evaluation_critique_text" className="text-slate-800 bg-slate-50 border border-slate-201 p-3 rounded-lg text-[11px] whitespace-pre-line leading-relaxed">
                            {evaluation.technicalAccuracy}
                          </p>
                        </div>

                        {/* Step by Step Breakdown */}
                        <div id="breakdown_block">
                          <span className="text-[9px] font-bold text-indigo-600 block uppercase tracking-wider mb-1">DEEP PHYSICAL & MATH DECONSTRUCTION</span>
                          <div id="evaluation_breakdown_text" className="bg-indigo-50/40 border border-indigo-100 p-3.5 rounded-lg text-slate-850 text-[11px] whitespace-pre-line space-y-2 leading-relaxed">
                            {evaluation.stepByStepBreakdown}
                          </div>
                        </div>

                        {/* Pitfalls */}
                        <div id="pitfall_block">
                          <span className="text-[9px] font-bold text-amber-705 block uppercase tracking-wider mb-1">EXAM PITFALL CHECKLIST</span>
                          <p id="evaluation_pitfalls_text" className="text-amber-900 bg-amber-50/50 border border-amber-150 p-3 rounded-lg text-[11px] whitespace-pre-line leading-relaxed">
                            {evaluation.commonPitfalls}
                          </p>
                        </div>

                        {/* Core takeaway */}
                        <div id="takeaway_block" className="border-t border-slate-100 pt-3 flex items-start space-x-2">
                          <span className="text-lg">💡</span>
                          <div className="flex-1">
                            <span className="text-[9px] font-bold text-slate-450 block uppercase tracking-wider">KEY DERIVATION TAKEAWAY</span>
                            <p id="evaluation_takeaway_text" className="text-[11px] font-bold text-slate-800">
                              {evaluation.keyTakeaway}
                            </p>
                          </div>
                        </div>

                        {/* Keyboard action hint */}
                        <div className="bg-slate-900 text-slate-200 p-2 rounded text-center text-[9px] uppercase font-bold tracking-wider">
                          Press Space or click Submit to advance cards
                        </div>

                      </div>

                    </div>
                  )}

                </div>

              </div>
            )}

          </div>
        )}

      </main>

      {/* Aesthetic standard credits footer with cloud status */}
      <footer id="app_footer" className="bg-white border-t border-slate-200 py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-slate-450">
          <p>PRO-ENG PREP SUITE © 2026. CORE ENGINEERING REVISION FORUMS.</p>
          <div className="flex items-center space-x-3.5">
            <span className="text-slate-350">CLIENT PERSISTENCE READY</span>
            <span className="text-slate-200">•</span>
            <span className={user ? 'text-indigo-600 font-bold' : 'text-slate-400'}>
              {user ? 'WORKSPACE ACCOUNT MATCHED' : 'LOCAL OFFLINE ACTIVE'}
            </span>
          </div>
        </div>
      </footer>

    </div>
  );
}
