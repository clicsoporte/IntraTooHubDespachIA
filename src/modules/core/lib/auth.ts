/**
 * @fileoverview Server-side authentication and user management functions.
 * These functions interact directly with the database to handle user data.
 * This file implements secure password handling using bcryptjs.
 * All functions in this file are server-only.
 */
'use server';

import { 
    connectDb, 
    getCompanySettings, 
    getAllCustomers, 
    getAllProducts, 
    getAllStock, 
    getAllExemptions, 
    getExemptionLaws, 
    getUnreadSuggestions, 
    getDbModules, 
    getAllRoles,
    saveAllUsers as saveAllUsersServer, 
    addUser as addUserServer, 
    comparePasswords as comparePasswordsServer 
} from './db';
import { sendEmail, getEmailSettings as getEmailSettingsFromDb } from './email-service';
import type { User, ExchangeRateApiResponse, EmailSettings, Role } from '@/modules/core/types';
import bcrypt from 'bcryptjs';
import { logInfo, logWarn, logError } from './logger';
import { headers, cookies } from 'next/headers';
import { getExchangeRate, getEmailSettings } from './api-actions';
import { NewUserSchema, UserSchema } from './auth-schemas';
import { confirmModification as confirmPlannerModificationServer } from '../../planner/lib/db';
import { revalidatePath } from 'next/cache';

const DB_FILE = 'intratool.db';
const SALT_ROUNDS = 10;
const SESSION_COOKIE_NAME = 'clic-tools-session';
const SESSION_DURATION = 8 * 60 * 60 * 1000; // 8 hours in milliseconds

export async function hasPermission(userId: number, permission: string): Promise<boolean> {
    const db = await connectDb();
    const userRoleInfo = db.prepare('SELECT role FROM users WHERE id = ?').get(userId) as { role: string } | undefined;

    if (!userRoleInfo) return false;
    if (userRoleInfo.role === 'admin') return true;

    const role = db.prepare('SELECT permissions FROM roles WHERE id = ?').get(userRoleInfo.role) as { permissions: string } | undefined;
    if (!role) return false;

    const permissions: string[] = JSON.parse(role.permissions);
    return permissions.includes(permission);
}

export async function login(email: string, passwordProvided: string, clientInfo: { ip: string; host: string; }): Promise<{ user: User | null, forcePasswordChange: boolean }> {
  const db = await connectDb();
  const logMeta = { email, ...clientInfo };
  try {
    const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
    const user: User | undefined = stmt.get(email) as User | undefined;

    if (user && user.password) {
      const isMatch = await bcrypt.compare(passwordProvided, user.password);
      if (isMatch) {
        const { password: _, ...userWithoutPassword } = user;
        
        const useSecureCookie = process.env.CLIC_TOOLS_COOKIE_SECURE === 'true';

        cookies().set(SESSION_COOKIE_NAME, String(user.id), {
            httpOnly: true,
            secure: useSecureCookie,
            maxAge: SESSION_DURATION / 1000,
            path: '/',
        });

        await logInfo(`User '${user.name}' logged in successfully.`, logMeta);
        return { user: userWithoutPassword as User, forcePasswordChange: !!user.forcePasswordChange };
      }
    }
    await logWarn(`Failed login attempt for email: ${email}`, logMeta);
    return { user: null, forcePasswordChange: false };
  } catch (error: any) {
    console.error('Login error:', error);
    await logError(`Login process failed for email: ${email}`, { error: error.message, ...logMeta});
    return { user: null, forcePasswordChange: false };
  }
}

export async function logout(): Promise<void> {
    const cookieStore = cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
    
    if (sessionCookie && sessionCookie.value) {
        const userId = Number(sessionCookie.value);
        const db = await connectDb();
        const user = db.prepare('SELECT name FROM users WHERE id = ?').get(userId) as { name: string } | undefined;
        if (user) {
            await logInfo(`User '${user.name}' logged out.`, { userId });
        }
    }
    
    const useSecureCookie = process.env.CLIC_TOOLS_COOKIE_SECURE === 'true';
    
    cookieStore.set(SESSION_COOKIE_NAME, '', {
        httpOnly: true,
        secure: useSecureCookie,
        maxAge: 0,
        path: '/',
    });
}

async function getAllUsersWithPasswords(): Promise<User[]> {
    const db = await connectDb();
    try {
        const stmt = db.prepare('SELECT * FROM users ORDER BY name');
        return stmt.all() as User[];
    } catch (error) {
        console.error('Failed to get all users:', error);
        return [];
    }
}

export async function getAllUsers(): Promise<User[]> {
    const users = await getAllUsersWithPasswords();
    return users.map(u => {
        const { password: _, ...userWithoutPassword } = u;
        return userWithoutPassword;
    }) as User[];
}

export async function getAllUsersForReport(): Promise<User[]> {
    const db = await connectDb();
    try {
        const stmt = db.prepare('SELECT * FROM users ORDER BY name');
        const users = stmt.all() as User[];
        return users.map(u => {
            const { password: _, ...userWithoutPassword } = u;
            return userWithoutPassword;
        }) as User[];
    } catch (error: any) {
        await logError('getAllUsersForReport', { error: (error as Error).message });
        return [];
    }
}

export async function getCurrentUser(): Promise<User | null> {
    const cookieStore = cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);

    if (!sessionCookie || !sessionCookie.value) {
        return null;
    }

    const userId = Number(sessionCookie.value);
    if (isNaN(userId)) {
        return null;
    }

    const db = await connectDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as User | undefined;

    if (!user) {
        return null;
    }

    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword as User;
}

export async function getInitialAuthData() {
    revalidatePath('/', 'layout');
    
    const dbModules = await getDbModules();
    for (const dbModule of dbModules) {
        if ('dbFile' in dbModule) {
            await connectDb(dbModule.dbFile);
        }
    }
    
    const [
        users,
        roles,
        companySettings,
        customers,
        products,
        stock,
        exemptions,
        exemptionLaws,
        exchangeRate,
        unreadSuggestions
    ] = await Promise.all([
        getAllUsers(),
        getAllRoles(),
        getCompanySettings(),
        getAllCustomers(),
        getAllProducts(),
        getAllStock(),
        getAllExemptions(),
        getExemptionLaws(),
        getExchangeRate(),
        getUnreadSuggestions()
    ]);
    
    let rateData: { rate: number | null; date: string | null } = { rate: null, date: null };
    const exchangeRateResponse = exchangeRate as ExchangeRateApiResponse;
    if (exchangeRateResponse?.venta?.valor) {
        rateData.rate = exchangeRateResponse.venta.valor;
        rateData.date = new Date(exchangeRateResponse.venta.fecha).toLocaleDateString('es-CR', { day: '2-digit', month: '2-digit', year: '2-digit' });
    }

    return {
        users,
        roles,
        companySettings,
        customers,
        products,
        stock,
        exemptions,
        exemptionLaws,
        exchangeRate: rateData,
        unreadSuggestions
    };
}

export async function sendPasswordRecoveryEmail(email: string, clientInfo: { ip: string; host: string; }): Promise<void> {
    const db = await connectDb();
    const logMeta = { email, ...clientInfo };

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as User | undefined;
    if (!user) {
        await logWarn('Password recovery requested for non-existent email.', logMeta);
        return;
    }

    const tempPassword = Math.random().toString(36).slice(-8);
    const hashedPassword = await bcrypt.hash(tempPassword, SALT_ROUNDS);

    db.prepare('UPDATE users SET password = ?, forcePasswordChange = 1 WHERE id = ?')
      .run(hashedPassword, user.id);

    try {
        const emailSettings = await getEmailSettingsFromDb();
        if (!emailSettings.smtpHost) {
            throw new Error('La configuración de SMTP no está establecida. No se puede enviar el correo.');
        }
        
        const emailBody = (emailSettings.recoveryEmailBody || '')
            .replace('[NOMBRE_USUARIO]', user.name)
            .replace('[CLAVE_TEMPORAL]', tempPassword);
            
        await sendEmail({
            to: user.email,
            subject: emailSettings.recoveryEmailSubject || 'Recuperación de Contraseña',
            html: emailBody
        });

        await logInfo(`Password recovery email sent successfully to ${user.name}.`, logMeta);
    } catch (error: any) {
        await logError('Failed to send password recovery email.', { ...logMeta, error: error.message });
        throw new Error('No se pudo enviar el correo de recuperación. Revisa la configuración de SMTP.');
    }
}
export async function saveAllUsers(users: User[]): Promise<void> {
    return saveAllUsersServer(users);
}
export async function addUser(userData: Omit<User, 'id' | 'avatar' | 'recentActivity' | 'securityQuestion' | 'securityAnswer'> & { password: string, forcePasswordChange: boolean }): Promise<User> {
    return addUserServer(userData);
}
export async function comparePasswords(userId: number, password: string, clientInfo?: { ip: string, host: string }): Promise<boolean> {
    return comparePasswordsServer(userId, password, clientInfo);
}
