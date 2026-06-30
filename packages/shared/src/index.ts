import { z } from "zod";

export const roleSchema = z.enum(["USER", "ADMIN"]);
export type Role = z.infer<typeof roleSchema>;

export const difficultySchema = z.enum(["EASY", "MEDIUM", "HARD"]);
export type Difficulty = z.infer<typeof difficultySchema>;

export const authSchemas = {
  register: z.object({
    name: z.string().min(2).max(80),
    email: z.string().email(),
    password: z.string().min(10).max(128)
  }),
  login: z.object({
    email: z.string().email(),
    password: z.string().min(1)
  }),
  forgotPassword: z.object({
    email: z.string().email()
  }),
  resetPassword: z.object({
    token: z.string().min(16),
    password: z.string().min(10).max(128)
  })
};

export const interviewSchemas = {
  create: z.object({
    role: z.string().min(2).max(80),
    stack: z.array(z.string().min(1)).min(1).max(12),
    difficulty: difficultySchema,
    type: z.enum(["TECHNICAL", "BEHAVIORAL", "MIXED"])
  }),
  answer: z.object({
    questionId: z.string().min(1),
    answer: z.string().min(3).max(6000)
  })
};

export const resumeSchemas = {
  analyze: z.object({
    jobDescription: z.string().max(12000).optional()
  })
};

export const roadmapSchemas = {
  create: z.object({
    targetRole: z.string().min(2).max(80),
    currentSkills: z.array(z.string()).max(40),
    timelineWeeks: z.number().int().min(4).max(52)
  })
};

export const codingSchemas = {
  execute: z.object({
    roomId: z.string().min(1),
    language: z.enum(["javascript", "typescript", "python", "java", "cpp"]),
    sourceCode: z.string().min(1).max(20000),
    stdin: z.string().max(4000).optional()
  })
};

export type RegisterInput = z.infer<typeof authSchemas.register>;
export type LoginInput = z.infer<typeof authSchemas.login>;
export type CreateInterviewInput = z.infer<typeof interviewSchemas.create>;
export type AnswerInterviewInput = z.infer<typeof interviewSchemas.answer>;
export type CreateRoadmapInput = z.infer<typeof roadmapSchemas.create>;
export type ExecuteCodeInput = z.infer<typeof codingSchemas.execute>;
