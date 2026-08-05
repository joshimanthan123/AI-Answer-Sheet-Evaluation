import User from "../models/User.js";
import Exam from "../models/Exam.js";
import AnswerSheet from "../models/AnswerSheet.js";
import Evaluation from "../models/Evaluation.js";
import Notification from "../models/Notification.js";
import Subject from "../models/Subject.js";
import { ROLES } from "../constants/roles.js";

export const getStudentDashboard = async (studentId) => {
  const now = new Date();

  // 1. Upcoming & Active Exams
  const upcomingExams = await Exam.find({
    examDate: { $gt: now },
    isPublished: true,
    isDeleted: false,
    examStatus: "Published",
  })
    .populate("subject", "name code")
    .limit(5);

  const activeExams = await Exam.find({
    isPublished: true,
    isDeleted: false,
    examStatus: "Active",
  })
    .populate("subject", "name code")
    .limit(5);

  // 2. Student Answer Sheets (representing completed/in-progress exam sessions)
  const studentSubmissions = await AnswerSheet.find({
    student: studentId,
    isDeleted: false,
  }).populate("exam", "title totalMarks duration");

  const completedExams = studentSubmissions.filter((sheet) =>
    ["Submitted", "Pending AI Evaluation", "Faculty Review", "Published"].includes(
      sheet.submissionStatus
    )
  );

  // 3. Evaluations & Results
  const answerSheetIds = studentSubmissions.map((sheet) => sheet._id);
  const evaluations = await Evaluation.find({
    answerSheet: { $in: answerSheetIds },
    isDeleted: false,
    evaluationStatus: "PUBLISHED",
  })
    .populate({
      path: "answerSheet",
      populate: { path: "exam", select: "title totalMarks" },
    })
    .sort("-createdAt")
    .limit(5);

  // 4. Calculations
  const averageStatistics = await Evaluation.aggregate([
    {
      $match: {
        answerSheet: { $in: answerSheetIds },
        isDeleted: false,
        evaluationStatus: "PUBLISHED",
      },
    },
    {
      $group: {
        _id: null,
        avgMarks: { $avg: "$obtainedMarks" },
        avgPercentage: { $avg: "$percentage" },
      },
    },
  ]);

  const averageMarks =
    averageStatistics.length > 0 ? Number(averageStatistics[0].avgMarks.toFixed(2)) : 0;
  const averagePercentage =
    averageStatistics.length > 0 ? Number(averageStatistics[0].avgPercentage.toFixed(2)) : 0;

  // 5. Notifications
  const notifications = await Notification.find({
    user: studentId,
    read: false,
    isDeleted: false,
  })
    .sort("-createdAt")
    .limit(5);

  return {
    summary: {
      upcomingCount: upcomingExams.length,
      activeCount: activeExams.length,
      completedCount: completedExams.length,
      averageMarks,
      averagePercentage,
      unreadNotificationsCount: await Notification.countDocuments({
        user: studentId,
        read: false,
        isDeleted: false,
      }),
    },
    upcomingExams,
    activeExams,
    completedExams: completedExams.slice(0, 5),
    latestResults: evaluations,
    notifications,
  };
};

export const getFacultyDashboard = async (facultyId) => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  // 1. Today's Exams created by this faculty
  const todaysExams = await Exam.find({
    createdBy: facultyId,
    examDate: { $gte: todayStart, $lte: todayEnd },
    isDeleted: false,
  }).populate("subject", "name code");

  // Fetch all exams created by this faculty
  const facultyExams = await Exam.find({ createdBy: facultyId, isDeleted: false });
  const examIds = facultyExams.map((e) => e._id);

  // 2. Pending Submissions (started/autosave but not submitted yet)
  const pendingSubmissionsCount = await AnswerSheet.countDocuments({
    exam: { $in: examIds },
    submissionStatus: { $in: ["Started", "Auto Saving", "Pending"] },
    isDeleted: false,
  });

  // 3. Submissions submitted but evaluation not published or in faculty review
  const pendingReviewsCount = await Evaluation.countDocuments({
    answerSheet: {
      $in: await AnswerSheet.find({ exam: { $in: examIds }, isDeleted: false }).distinct("_id"),
    },
    evaluationStatus: { $in: ["AI_COMPLETED", "FACULTY_REVIEW", "AI_PENDING"] },
    isDeleted: false,
  });

  // 4. Published results
  const publishedCount = await Evaluation.countDocuments({
    answerSheet: {
      $in: await AnswerSheet.find({ exam: { $in: examIds }, isDeleted: false }).distinct("_id"),
    },
    evaluationStatus: "PUBLISHED",
    isDeleted: false,
  });

  // 5. Average evaluation time (between answer sheet submittedAt and evaluation createdAt)
  const completedEvaluations = await Evaluation.find({
    answerSheet: {
      $in: await AnswerSheet.find({ exam: { $in: examIds }, isDeleted: false }).distinct("_id"),
    },
    isDeleted: false,
  }).populate("answerSheet", "submittedAt");

  let totalEvalTimeMs = 0;
  let evalCount = 0;

  completedEvaluations.forEach((evalItem) => {
    if (evalItem.answerSheet && evalItem.answerSheet.submittedAt) {
      const diffMs = evalItem.createdAt - evalItem.answerSheet.submittedAt;
      totalEvalTimeMs += diffMs;
      evalCount++;
    }
  });

  const averageEvaluationTimeMinutes =
    evalCount > 0 ? Math.round(totalEvalTimeMs / (1000 * 60 * evalCount)) : 0;

  return {
    summary: {
      todaysExamsCount: todaysExams.length,
      pendingSubmissionsCount,
      pendingReviewsCount,
      publishedCount,
      averageEvaluationTimeMinutes,
    },
    todaysExams,
    recentSubmissions: await AnswerSheet.find({
      exam: { $in: examIds },
      isDeleted: false,
    })
      .populate("student", "name email rollNo")
      .populate("exam", "title")
      .sort("-createdAt")
      .limit(5),
  };
};

export const getAdminDashboard = async () => {
  const totalStudents = await User.countDocuments({ role: ROLES.STUDENT, isDeleted: false });
  const totalFaculty = await User.countDocuments({ role: ROLES.FACULTY, isDeleted: false });

  const totalExams = await Exam.countDocuments({ isDeleted: false });
  const totalSubjects = await Subject.countDocuments({ isDeleted: false });

  const activeExamsCount = await Exam.countDocuments({ examStatus: "Active", isDeleted: false });
  const completedExamsCount = await Exam.countDocuments({
    examStatus: "Completed",
    isDeleted: false,
  });

  return {
    summary: {
      totalStudents,
      totalFaculty,
      totalExams,
      totalSubjects,
      activeExamsCount,
      completedExamsCount,
    },
    systemStatistics: {
      activeExams: await Exam.find({ examStatus: "Active", isDeleted: false })
        .populate("subject", "name code")
        .populate("createdBy", "name email")
        .limit(5),
      recentUsers: await User.find({ isDeleted: false })
        .select("name email role createdAt")
        .sort("-createdAt")
        .limit(10),
    },
  };
};

export default {
  getStudentDashboard,
  getFacultyDashboard,
  getAdminDashboard,
};
