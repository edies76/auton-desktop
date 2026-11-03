import type { AutonProject, AutonProjectSpaceData } from "./model.js";

const DEMO_NOW = Date.now();

export function demoProjects(): AutonProject[] {
  return [
    {
      id: "lunar-movil",
      name: "Lunar móvil",
      path: "C:\\proyectos\\lunar-movil",
      lastActiveAt: DEMO_NOW - 2 * 60_000,
    },
    {
      id: "auton-docs",
      name: "Auton docs",
      path: "C:\\proyectos\\auton-docs",
      lastActiveAt: DEMO_NOW - 3 * 60 * 60_000,
    },
    {
      id: "landing-meta",
      name: "Landing Meta",
      path: "C:\\proyectos\\landing-meta",
      lastActiveAt: DEMO_NOW - 26 * 60 * 60_000,
    },
  ];
}

export function demoDataForProject(project: AutonProject): AutonProjectSpaceData {
  return {
    messages: [
      {
        id: "m1",
        at: DEMO_NOW - 150_000,
        role: "human",
        text: "Mejora el diseño del chat y arregla el error de inicio de sesión.",
      },
      {
        id: "m2",
        at: DEMO_NOW - 140_000,
        role: "orchestrator",
        text: "Voy a trabajar los dos frentes. Un worker revisa el diseño y otro investiga el inicio de sesión.",
      },
      {
        id: "m3",
        at: DEMO_NOW - 70_000,
        role: "orchestrator",
        text: "El problema de sesión parece estar en la recuperación del usuario. Le pedí que confirme la causa antes de tocarla.",
      },
    ],
    workers: [
      {
        id: "worker-1",
        name: "worker 1",
        status: "trabajando",
        startedAt: DEMO_NOW - 134_000,
        lastSignalAt: DEMO_NOW - 3_000,
        lastLine: "ajustando el cuadro de mensajes",
        transcript: [
          { id: "w1e1", at: DEMO_NOW - 132_000, kind: "message", text: "Empiezo por el cuadro de mensajes." },
          { id: "w1e2", at: DEMO_NOW - 80_000, kind: "tool", text: "Edit packages/ui/src/chat/MessageBubble.tsx" },
          { id: "w1e3", at: DEMO_NOW - 3_000, kind: "message", text: "Ajustando el espaciado y el contraste." },
        ],
      },
      {
        id: "worker-2",
        name: "worker 2",
        status: "preguntando",
        startedAt: DEMO_NOW - 98_000,
        lastSignalAt: DEMO_NOW - 75_000,
        lastLine: "necesita el criterio de hecho",
        transcript: [
          { id: "w2e1", at: DEMO_NOW - 96_000, kind: "message", text: "Reviso la restauración de sesión." },
          {
            id: "w2e2",
            at: DEMO_NOW - 75_000,
            kind: "question",
            text: "¿El login debe recordar la sesión entre reinicios?",
          },
        ],
      },
      {
        id: "worker-3",
        name: "worker 3",
        status: "terminado",
        startedAt: DEMO_NOW - 300_000,
        lastSignalAt: DEMO_NOW - 120_000,
        lastLine: "2 archivos, build en verde",
        transcript: [
          { id: "w3e1", at: DEMO_NOW - 280_000, kind: "message", text: "Corrijo el tipo de retorno del login." },
          { id: "w3e2", at: DEMO_NOW - 120_000, kind: "close", text: "Terminado: 2 archivos, build en verde." },
        ],
      },
    ],
    tramos: [
      {
        id: "tramo-1",
        startedAt: DEMO_NOW - 134_000,
        workerIds: ["worker-1", "worker-2"],
      },
    ],
    plan: {
      goalTitle: project.name,
      items: [
        { id: "s1", title: "Revisar el diseño del chat", status: "running", owner: "programmer" },
        { id: "s2", title: "Diagnosticar el inicio de sesión", status: "waiting", owner: "programmer" },
        { id: "s3", title: "Cerrar con evidencia", status: "ready", owner: "orchestrator" },
      ],
    },
    evidence: {
      id: "evidence-1",
      command: "pnpm --filter @zcode/ui test",
      output: "Test Files  1 passed (1)\nTests  3 passed (3)",
      files: ["packages/ui/src/chat/MessageBubble.tsx", "packages/ui/src/chat/messageSpacing.ts"],
    },
  };
}
