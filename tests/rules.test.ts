import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import { initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';

let testEnv: RulesTestEnvironment;
const NAMESPACE = 'demo-el-encargo-default-rtdb';

function createEmulatorJwt(uid: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      iss: `https://securetoken.google.com/${NAMESPACE}`,
      aud: NAMESPACE,
      user_id: uid,
      sub: uid,
      iat: Math.floor(Date.now() / 1000) - 60,
      exp: Math.floor(Date.now() / 1000) + 3600,
    })
  ).toString('base64url');
  return `${header}.${payload}.`;
}

function rtdbRest(
  method: 'GET' | 'PUT' | 'PATCH',
  dbPath: string,
  uid: string,
  body?: unknown
): Promise<{ status: number; data: unknown }> {
  return new Promise((resolve, reject) => {
    const token = createEmulatorJwt(uid);
    const payload = body !== undefined ? JSON.stringify(body) : undefined;
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: 9000,
        path: `${dbPath}.json?ns=${NAMESPACE}&auth=${encodeURIComponent(token)}`,
        method,
        headers: payload
          ? {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(payload),
            }
          : undefined,
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode || 500, data: raw ? JSON.parse(raw) : null });
          } catch {
            resolve({ status: res.statusCode || 500, data: raw });
          }
        });
      }
    );
    req.on('error', reject);
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

beforeAll(async () => {
  const rules = fs.readFileSync(path.resolve(process.cwd(), 'database.rules.json'), 'utf8');
  testEnv = await initializeTestEnvironment({
    projectId: NAMESPACE,
    database: {
      host: '127.0.0.1',
      port: 9000,
      rules,
    },
  });
}, 30000);

afterAll(async () => {
  if (testEnv) {
    await testEnv.cleanup();
  }
});

describe('Reglas de seguridad de Firebase Realtime Database (database.rules.json)', () => {
  it('permite al docente crear la sala y cambiar el estado, pero impide que un estudiante cambie el estado o el puntaje', async () => {
    // 1. Docente ('host-1') crea la sala K7M4X
    const createRoomRes = await rtdbRest('PUT', '/rooms/K7M4X', 'host-1', {
      hostUid: 'host-1',
      createdAt: Date.now(),
      config: { roundCount: 6, sequence: ['am-1'], durations: { 1: 180, 2: 240, 3: 300 } },
      state: {
        phase: 'open',
        roundIndex: 0,
        openedAt: Date.now() - 1000,
        deadline: Date.now() + 60000,
      },
    });
    expect(createRoomRes.status).toBe(200);

    // 2. Estudiante ('student-1') se registra con puntaje inicial 0
    const joinRes = await rtdbRest('PUT', '/rooms/K7M4X/players/student-1', 'student-1', {
      name: 'Valeria',
      joinedAt: Date.now(),
      lastSeen: Date.now(),
      score: 0,
      streak: 0,
    });
    expect(joinRes.status).toBe(200);

    // 3. Estudiante NO puede subirse el puntaje
    const cheatScoreRes = await rtdbRest('PUT', '/rooms/K7M4X/players/student-1/score', 'student-1', 9999);
    expect(cheatScoreRes.status).toBe(401);

    // 4. Estudiante NO puede cambiar la fase de la sala a 'revealed'
    const cheatStateRes = await rtdbRest('PATCH', '/rooms/K7M4X/state', 'student-1', {
      phase: 'revealed',
      roundIndex: 0,
    });
    expect(cheatStateRes.status).toBe(401);

    // 5. Estudiante SÍ puede enviar y actualizar su respuesta mientras phase === 'open' y antes del deadline usando { '.sv': 'timestamp' }
    const validAnswerRes = await rtdbRest('PUT', '/rooms/K7M4X/answers/0/student-1', 'student-1', {
      option: 'action-mapping',
      at: { '.sv': 'timestamp' },
    });
    expect(validAnswerRes.status).toBe(200);

    // 6. Estudiante NO puede falsificar el timestamp 'at' en el pasado para ganar más bono de rapidez
    const forgedTimestampRes = await rtdbRest('PUT', '/rooms/K7M4X/answers/0/student-1', 'student-1', {
      option: '4c-id',
      at: Date.now() - 50000,
    });
    expect(forgedTimestampRes.status).toBe(401);

    // 7. Docente cierra la ronda
    const closeRoundRes = await rtdbRest('PATCH', '/rooms/K7M4X/state', 'host-1', {
      phase: 'closed',
      roundIndex: 0,
    });
    expect(closeRoundRes.status).toBe(200);

    // 8. Estudiante NO puede cambiar su respuesta después de que la ronda se cerró
    const lateAnswerRes = await rtdbRest('PUT', '/rooms/K7M4X/answers/0/student-1', 'student-1', {
      option: '4c-id',
      at: { '.sv': 'timestamp' },
    });
    expect(lateAnswerRes.status).toBe(401);

    // 9. Docente SÍ puede actualizar el puntaje del estudiante al revelar
    const awardScoreRes = await rtdbRest('PUT', '/rooms/K7M4X/players/student-1/score', 'host-1', 890);
    expect(awardScoreRes.status).toBe(200);
  });
});
