import { createClient } from '@supabase/supabase-js';
import { Request, Response, NextFunction } from 'express';

// this file is modified from Claude AI 

type UserProfile = {
    id: string;
    username: string;
    email: string;
    isAdmin: boolean;
};

/**
 * Verifies the Supabase JWT from the Authorisation header. 
 * Attaches userId, userEmail, and an eauthenticated supabase client to the request.
 * 
 * @middleware
 * @returns {401} If no token is provided or the token is invalid/expired
 */
export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
        return res.status(401).json({
            code: 'UNAUTHORIZED',
            message: 'Authorization token required'
        });
    }

    const supabaseWithAuth = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_ANON_KEY!,
        {
            global: {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        }
    );

    const { data, error } = await supabaseWithAuth.auth.getUser();

    if (error || !data?.user) {
        return res.status(401).json({
            code: 'INVALID_TOKEN',
            message: 'Invalid or expired token'
        });
    }

    (req as any).userId = data.user.id;
    (req as any).userEmail = data.user.email;

    next();
};

/**
 * Verifies that the authenticated user has the admin role.
 * Calls the User Service GET /user/getUserInfo endpoint to retrieve the user's role.
 * Must be used after requireAuth.
 * 
 * @middleware
 * @returns {404} if the user profile is not found 
 * @returns {403} if the user is not an admin
 */
export const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
        return res.status(401).json({
            code: 'UNAUTHORIZED',
            message: 'Authorization token required'
        });
    }

    const response = await fetch(`${process.env.USER_SERVICE_URL}/user/getUserInfo`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
        }
    });

    if (!response.ok) {
        return res.status(401).json({
            code: 'UNAUTHORIZED',
            message: 'Could not verify user info'
        });
    }

    const profile = await response.json() as UserProfile;

    if (!profile.isAdmin) {
        return res.status(403).json({
            code: 'FORBIDDEN',
            message: 'Admin privileges required'
        });
    }

    next();
};