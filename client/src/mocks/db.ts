import { 
  User, Student, Faculty, Admin, Subject, Course, 
  Department, AnswerSheet, ModelAnswer, Evaluation, 
  EvaluationDetail, Notification, Feedback, Report, AuditLog 
} from '../types';

// 1. Departments Mock
export const mockDepartments: Department[] = [
  { id: 'dept-cs', name: 'Computer Science & Engineering', block: 'Block A, 3rd Floor', code: 'CSE' },
  { id: 'dept-physics', name: 'Natural Sciences & Physics', block: 'Block B, 1st Floor', code: 'PHY' },
  { id: 'dept-business', name: 'Business Administration & Law', block: 'Block C, 4th Floor', code: 'BUS' },
  { id: 'dept-arts', name: 'Arts & Humanities', block: 'Block D, 2nd Floor', code: 'ART' }
];

// 2. Courses Mock
export const mockCourses: Course[] = [
  { id: 'course-btech-cse', name: 'Bachelor of Technology (Computer Science)', code: 'BTECH-CSE', degree: 'Undergraduate', departmentId: 'dept-cs' },
  { id: 'course-mtech-cse', name: 'Master of Technology (Data Science)', code: 'MTECH-DS', degree: 'Postgraduate', departmentId: 'dept-cs' },
  { id: 'course-bsc-physics', name: 'Bachelor of Science (Physics Honors)', code: 'BSC-PHY', degree: 'Undergraduate', departmentId: 'dept-physics' },
  { id: 'course-mba', name: 'Master of Business Administration', code: 'MBA', degree: 'Postgraduate', departmentId: 'dept-business' }
];

// 3. Subjects Mock
export const mockSubjects: Subject[] = [
  { id: 'sub-math2', name: 'Advanced Mathematics II', code: 'MA-201', credits: 4, courseId: 'course-btech-cse' },
  { id: 'sub-ds', name: 'Data Structures and Algorithms', code: 'CS-101', credits: 4, courseId: 'course-btech-cse' },
  { id: 'sub-aml', name: 'Advanced Machine Learning', code: 'CS-402-AI', credits: 3, courseId: 'course-btech-cse' },
  { id: 'sub-phy', name: 'Molecular and Quantum Physics', code: 'PH-202', credits: 4, courseId: 'course-bsc-physics' },
  { id: 'sub-ethics', name: 'Ethics and Safety in AI Systems', code: 'CS-302', credits: 2, courseId: 'course-btech-cse' }
];

// 4. Users Mock (Base Users)
export const mockUsers: User[] = [
  { id: 'user-stud-1', name: 'Alex Johnson', email: 'student@university.edu', role: 'student', status: 'online', departmentId: 'dept-cs', avatar: '' },
  { id: 'user-fac-1', name: 'Dr. Sarah Jenkins', email: 'faculty@university.edu', role: 'faculty', status: 'online', departmentId: 'dept-cs', avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDTna1F-h4aEsS5cfL95fs7YtCHB85uBqsUOa0vNw2GwiVGbKZ5IeEk30z_LrDt-bRD_oLUCNALAr4Ohi_aN_pdLlYYgq6bCGYA7I5HTxKPnKYIYvjuVIggtcyHrfcP0TpN-KHE-gXN4dMn0ZdqTOMt7jheb7JBoTqRZmCH1zXE8SqgykM0ZAQNac-TyelmwWxwSuDppvtNRxe1T_GLAgpt5I3EFN1tQCTnOXhxrlvrUBPXKmUtVc0p' },
  { id: 'user-adm-1', name: 'System Administrator', email: 'admin@university.edu', role: 'admin', status: 'online', avatar: '' },
  
  // Extra Students for lists
  { id: 'user-stud-2', name: 'John Smith', email: 'j.smith@university.edu', role: 'student', status: 'online', departmentId: 'dept-cs' },
  { id: 'user-stud-3', name: 'Emma Davis', email: 'e.davis@university.edu', role: 'student', status: 'offline', departmentId: 'dept-cs' },
  { id: 'user-stud-4', name: 'Michael Lee', email: 'm.lee@university.edu', role: 'student', status: 'offline', departmentId: 'dept-cs' },
  { id: 'user-stud-5', name: 'Sarah Kim', email: 's.kim@university.edu', role: 'student', status: 'online', departmentId: 'dept-cs' }
];

// 5. Profile details matching roles
export const mockStudentProfile: Student = {
  id: 'stud-1',
  userId: 'user-stud-1',
  rollNo: '24-CSE-0042',
  enrolledYear: '2024',
  departmentId: 'dept-cs',
  reportsCount: 5,
  avgScore: 84.8,
  rank: 'Top 5%'
};

export const mockFacultyProfile: Faculty = {
  id: 'fac-1',
  userId: 'user-fac-1',
  designation: 'Dean of Computer Sciences',
  departmentId: 'dept-cs',
  subjectsCount: 3,
  coursesCount: 2
};

// 6. Answer Sheets (Submissions)
export const mockAnswerSheets: AnswerSheet[] = [
  {
    id: 'sheet-1',
    studentId: 'stud-1',
    studentName: 'Alex Johnson',
    subjectId: 'sub-ds',
    subjectName: 'Data Structures and Algorithms',
    examId: 'exam-mid-ds',
    examName: 'Mid-Term Examination',
    date: '2026-07-28',
    fileUrl: '#',
    fileName: 'Alex_Johnson_DSA_Midterm.pdf',
    status: 'evaluated',
    scanDpi: 300,
    inkColor: 'blue',
    evaluationId: 'eval-1'
  },
  {
    id: 'sheet-2',
    studentId: 'stud-1',
    studentName: 'Alex Johnson',
    subjectId: 'sub-math2',
    subjectName: 'Advanced Mathematics II',
    examId: 'exam-mid-math',
    examName: 'Mid-Semester Assembly II',
    date: '2026-07-29',
    fileUrl: '#',
    fileName: 'Alex_Johnson_Maths2_Midterm.pdf',
    status: 'pending',
    scanDpi: 300,
    inkColor: 'black'
  },
  {
    id: 'sheet-3',
    studentId: 'stud-1',
    studentName: 'Alex Johnson',
    subjectId: 'sub-ethics',
    subjectName: 'Ethics and Safety in AI Systems',
    examId: 'exam-ethics-quiz',
    examName: 'Final Revision Quiz',
    date: '2026-07-30',
    fileUrl: '#',
    fileName: 'Alex_Johnson_AI_Ethics.pdf',
    status: 'flagged',
    scanDpi: 200,
    inkColor: 'other',
    evaluationId: 'eval-2'
  },
  {
    id: 'sheet-4',
    studentId: 'stud-2',
    studentName: 'John Smith',
    subjectId: 'sub-ds',
    subjectName: 'Data Structures and Algorithms',
    examId: 'exam-mid-ds',
    examName: 'Mid-Term Examination',
    date: '2026-07-31',
    fileUrl: '#',
    fileName: 'John_Smith_DSA_Midterm.pdf',
    status: 'pending',
    scanDpi: 300,
    inkColor: 'blue'
  },
  {
    id: 'sheet-5',
    studentId: 'stud-3',
    studentName: 'Emma Davis',
    subjectId: 'sub-ds',
    subjectName: 'Data Structures and Algorithms',
    examId: 'exam-mid-ds',
    examName: 'Mid-Term Examination',
    date: '2026-07-31',
    fileUrl: '#',
    fileName: 'Emma_Davis_DSA_Midterm.pdf',
    status: 'pending',
    scanDpi: 300,
    inkColor: 'blue'
  }
];

// 7. Model Answers
export const mockModelAnswers: ModelAnswer[] = [
  {
    id: 'model-1',
    subjectId: 'sub-ds',
    subjectName: 'Data Structures and Algorithms',
    examId: 'exam-mid-ds',
    examName: 'Mid-Term Examination',
    courseCode: 'CS-101',
    fileUrl: '#',
    fileName: 'CS101_Midterm_Model_Solutions.pdf',
    uploadDate: '2026-07-15',
    comments: 'Uploaded by Course Coordinator. Incorporates basic expected concepts and runtime complexities.',
    facultyName: 'Dr. Sarah Jenkins'
  },
  {
    id: 'model-2',
    subjectId: 'sub-aml',
    subjectName: 'Advanced Machine Learning',
    examId: 'exam-final-aml',
    examName: 'Final-Semester Assessment',
    courseCode: 'CS-402-AI',
    fileUrl: '#',
    fileName: 'CS402AI_Final_Model_Solutions.pdf',
    uploadDate: '2026-07-20',
    comments: 'Standard answers referencing neural model optimizations.',
    facultyName: 'Dr. Sarah Jenkins'
  }
];

// 8. Evaluations Mock
export const mockEvaluations: Evaluation[] = [
  {
    id: 'eval-1',
    answerSheetId: 'sheet-1',
    evaluatorId: 'fac-1',
    evaluatorName: 'Dr. Sarah Jenkins',
    finalScore: 85,
    totalScore: 100,
    grade: 'A-',
    timeTakenSeconds: 3120, // 52 minutes
    similarityIndex: 12,
    strengths: [
      'Excellent conceptual understanding of foundational data structures (Stacks, Queues).',
      'Strong terminological accuracy in defining complexity classes.'
    ],
    weaknesses: [
      'Confusion between algorithmic logic (Binary Search vs. Linear Search) in Question 3.',
      'Pseudocode formatting lacks industry-standard indentation.'
    ],
    suggestions: [
      'Review Divide and Conquer algorithms to master Binary Search logic.',
      'Practice writing pseudocode for recursive functions specifically.'
    ],
    date: '2026-07-28',
    status: 'approved'
  },
  {
    id: 'eval-2',
    answerSheetId: 'sheet-3',
    evaluatorId: 'fac-1',
    evaluatorName: 'Dr. Sarah Jenkins',
    finalScore: 32,
    totalScore: 50,
    grade: 'C+',
    timeTakenSeconds: 1560,
    similarityIndex: 68, // Flagged due to high plagiarism
    strengths: ['Clear definition of ethical theories.'],
    weaknesses: ['Large paragraphs match verbatim with internet academic sources.', 'Lacks personal analysis.'],
    suggestions: ['Include correct citations and reframe matching arguments in your own writing.'],
    date: '2026-07-30',
    status: 'pending_review'
  }
];

// 9. Evaluation Details (Question-wise)
export const mockEvaluationDetails: Record<string, EvaluationDetail[]> = {
  'eval-1': [
    {
      id: 'dt-1-1',
      evaluationId: 'eval-1',
      questionId: 'q-ds-1',
      questionNumber: 1,
      questionText: 'Define Time Complexity and give an example of O(n log n) runtime complexity.',
      weight: 10,
      score: 10,
      suggestedScore: 9.5,
      feedback: 'Perfect explanation matching the rubric framework and accurate example code.',
      status: 'match',
      expectedAnswer: 'Computational complexity that describes the amount of computer time to run an algorithm. Merge sort or Heap sort is O(n log n).',
      studentAnswer: 'Time complexity measures how runtime grows with input size. Merge sort is a key example of O(n log n) because it recursively splits the array and operates in linear time per split level.',
      conceptMatch: 94
    },
    {
      id: 'dt-1-2',
      evaluationId: 'eval-1',
      questionId: 'q-ds-2',
      questionNumber: 2,
      questionText: 'Explain the structural differences between a Stack and a Queue.',
      weight: 10,
      score: 9,
      suggestedScore: 8.8,
      feedback: 'Solid structural explanation. Drew a diagram. Deducted 1 mark as diagram was slightly mislabeled at the base.',
      status: 'match',
      expectedAnswer: 'Stack is LIFO (Last-In-First-Out) where pushes and pops happen at the top. Queue is FIFO (First-In-First-Out) where insertions are at rear and deletions at front.',
      studentAnswer: 'Stack uses LIFO logic, while Queue uses FIFO logic. Stacks are like a pile of plates: you put them on the top and take them off from the top. Queues are like line queues, first come first served.',
      conceptMatch: 88
    },
    {
      id: 'dt-1-3',
      evaluationId: 'eval-1',
      questionId: 'q-ds-3',
      questionNumber: 3,
      questionText: 'Write a pseudocode for Binary Search on a sorted array.',
      weight: 15,
      score: 3,
      suggestedScore: 3.0,
      feedback: 'The student provided O(n) linear search code instead of the divide-conquer binary search algorithm.',
      status: 'miss',
      expectedAnswer: 'Initialize low = 0, high = n-1. Loop while low <= high: mid = (low + high)/2. If key matches, return mid. If key < mid, high = mid - 1. Else, low = mid + 1. Return -1.',
      studentAnswer: 'function search(arr, key) { for(let i=0; i<arr.length; i++) { if(arr[i] === key) return i; } return -1; }',
      conceptMatch: 32
    }
  ]
};

// 10. Notifications Mock
export const mockNotifications: Notification[] = [
  {
    id: 'notif-1',
    userId: 'user-fac-1',
    title: 'New Evaluation Submission',
    message: 'New answer sheet uploaded for Subject CS-101. Student: Michael Lee.',
    date: '2026-07-31T11:45:00Z',
    read: false,
    type: 'info'
  },
  {
    id: 'notif-2',
    userId: 'user-fac-1',
    title: 'AI Scans Completed',
    message: 'AI OCR and initial grading has been resolved for 45 scripts of Calculus II.',
    date: '2026-07-31T10:30:00Z',
    read: false,
    type: 'success'
  },
  {
    id: 'notif-3',
    userId: 'user-stud-1',
    title: 'Result Published',
    message: 'Your answer sheet for Data Structures and Algorithms has been evaluated. Score: 85/100.',
    date: '2026-07-28T16:00:00Z',
    read: false,
    type: 'success'
  },
  {
    id: 'notif-4',
    userId: 'user-stud-1',
    title: 'Quiz Flag Alert',
    message: 'Your Quiz Submission (AI Ethics) has been flagged by the AI engine: High similarity score.',
    date: '2026-07-30T14:15:00Z',
    read: true,
    type: 'warning'
  },
  {
    id: 'notif-5',
    userId: 'user-adm-1',
    title: 'System Security Log Alert',
    message: '42 blocked login attempts detected from off-campus IP ranges within the last 2 hours.',
    date: '2026-07-31T11:30:00Z',
    read: false,
    type: 'alert'
  }
];

// 11. Feedbacks Mock
export const mockFeedbacks: Feedback[] = [
  { id: 'f-1', studentId: 'stud-1', studentName: 'Alex Johnson', message: 'The OCR recognized my diagrams accurately. The detail feedback on my mistakes is helpful.', rating: 5, date: '2026-07-29' }
];

// 12. Reports Mock
export const mockReports: Report[] = [
  { id: 'rep-1', name: 'Grade_Distribution_Calculus_2026.pdf', type: 'analytic', status: 'completed', date: '2026-07-15', fileUrl: '#' },
  { id: 'rep-2', name: 'Plagiarism_Report_BTech_CS.pdf', type: 'system', status: 'completed', date: '2026-07-22', fileUrl: '#' },
  { id: 'rep-3', name: 'Semester_Performance_Review.pdf', type: 'grade', status: 'generating', date: '2026-07-31', fileUrl: '#' }
];

// 13. System Audit Logs Mock (Admin Module)
export const mockAuditLogs: AuditLog[] = [
  { id: 'log-1', userId: 'user-adm-1', userName: 'Admin Head', role: 'ADMIN', action: 'Update AI Engine Parameters (Similarity Level -> 75%)', ipAddress: '192.168.1.100', timestamp: '2026-07-31T10:45:00Z', status: 'success', level: 'info', message: 'Update AI Engine Parameters (Similarity Level -> 75%)' },
  { id: 'log-2', userId: 'user-fac-1', userName: 'Dr. Sarah Jenkins', role: 'FACULTY', action: 'Approve manual evaluation for sheet-1', ipAddress: '192.168.1.15', timestamp: '2026-07-31T09:20:00Z', status: 'success', level: 'info', message: 'Approve manual evaluation for sheet-1' },
  { id: 'log-3', userId: 'user-stud-1', userName: 'Alex Johnson', role: 'STUDENT', action: 'Upload sheet-3 for analysis', ipAddress: '10.0.4.88', timestamp: '2026-07-30T14:10:00Z', status: 'success', level: 'info', message: 'Upload sheet-3 for analysis' },
  { id: 'log-4', userId: 'unknown', userName: 'IP 203.0.113.44', role: 'GUEST', action: 'Login brute-force suspicion', ipAddress: '203.0.113.44', timestamp: '2026-07-31T11:28:00Z', status: 'failed', level: 'error', message: 'Login brute-force suspicion - Failed credentials' }
];

// 14. Chart Mock Analytics
export const mockStudentTermTrends = [
  { name: 'Sem 1', score: 78, accuracy: 92 },
  { name: 'Sem 2', score: 81, accuracy: 95 },
  { name: 'Sem 3', score: 82, accuracy: 96 },
  { name: 'Sem 4', score: 85, accuracy: 98 },
  { name: 'Current', score: 88, accuracy: 99.8 }
];

export const mockFacultyTopicTrends = [
  { name: 'Arrays/Lists', score: 82, accuracy: 98 },
  { name: 'Trees/Graphs', score: 68, accuracy: 96 },
  { name: 'Recursion', score: 74, accuracy: 97 },
  { name: 'OOP Concepts', score: 89, accuracy: 99 },
  { name: 'Complexity', score: 91, accuracy: 98.2 }
];

export const mockDefaultMetrics = {
  totalStudents: 1248,
  pendingEvaluations: 42,
  completedCount: 856,
  avgScore: 74.5,
  gradingAccuracy: 98.2
};

// 15. Exams Mock (iPad digital exam system)
export interface MockExamQuestion {
  number: number;
  text: string;
  maxMarks: number;
  expectedConcept: string;
  bloomsLevel: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
}

export interface MockExam {
  id: string;
  name: string;
  subjectCode: string;
  subjectName: string;
  date: string;
  time: string;
  durationMinutes: number;
  totalMarks: number;
  status: 'upcoming' | 'today' | 'completed';
  allowedMaterials: string[];
  instructions: string[];
  questions: MockExamQuestion[];
}

export const mockExams: MockExam[] = [
  {
    id: 'exam-1',
    name: 'Mid-Term Examination 2026',
    subjectCode: 'CS-101',
    subjectName: 'Data Structures and Algorithms',
    date: '2026-08-05',
    time: '10:00 AM',
    durationMinutes: 180,
    totalMarks: 100,
    status: 'upcoming',
    allowedMaterials: ['iPad Stylus', 'Scientific Calculator (Digital)', 'One A4 Cheat Sheet'],
    instructions: [
      'Write all code solutions inside the digital drawing grids clearly.',
      'Auto-save matches every stroke. Ensure active iPad Pencil Bluetooth connection.',
      'Check question attempting summary before submitting final answers.'
    ],
    questions: [
      { number: 1, text: 'Define Time Complexity and give an example of O(n log n) runtime complexity.', maxMarks: 10, expectedConcept: 'Computational time, Heap/Merge sort example', bloomsLevel: 'Remember', difficulty: 'Easy' },
      { number: 2, text: 'Explain the structural differences between a Stack and a Queue.', maxMarks: 10, expectedConcept: 'LIFO vs FIFO structures', bloomsLevel: 'Understand', difficulty: 'Easy' },
      { number: 3, text: 'Write a pseudocode for Binary Search on a sorted array.', maxMarks: 15, expectedConcept: 'Divide & Conquer binary search indices', bloomsLevel: 'Apply', difficulty: 'Medium' }
    ]
  },
  {
    id: 'exam-2',
    name: 'Today\'s Practical Exam',
    subjectCode: 'CS-402-AI',
    subjectName: 'Advanced Machine Learning',
    date: new Date().toISOString().split('T')[0], // Today
    time: '02:00 PM',
    durationMinutes: 120,
    totalMarks: 50,
    status: 'today',
    allowedMaterials: ['Apple Pencil ONLY'],
    instructions: [
      'Sketch neural diagrams with visible activation gates.',
      'No secondary utilities allowed in the drafting zone.'
    ],
    questions: [
      { number: 1, text: 'Compare CNN vs Transformer attention bottlenecks.', maxMarks: 20, expectedConcept: 'Spatial inductive bias vs global attention self-attention', bloomsLevel: 'Analyze', difficulty: 'Hard' },
      { number: 2, text: 'Explain Gradient Descent momentum mechanisms.', maxMarks: 30, expectedConcept: 'Vibrations damping, velocity scaling parameter', bloomsLevel: 'Understand', difficulty: 'Medium' }
    ]
  },
  {
    id: 'exam-3',
    name: 'Ethics Quiz Assembly III',
    subjectCode: 'CS-302',
    subjectName: 'Ethics and Safety in AI Systems',
    date: '2026-07-30',
    time: '09:00 AM',
    durationMinutes: 60,
    totalMarks: 30,
    status: 'completed',
    allowedMaterials: ['iPad Drawing Stylus'],
    instructions: ['Write clean textual explanations. AI semantic matching thresholds applied.'],
    questions: [
      { number: 1, text: 'Explain three primary moral challenges of LLM alignment.', maxMarks: 30, expectedConcept: 'Bias enforcement, feedback loops, sycophancy', bloomsLevel: 'Evaluate', difficulty: 'Hard' }
    ]
  }
];
