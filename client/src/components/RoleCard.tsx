"use client";
import { Role } from "@/types";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "./ui/card";

interface RoleCardProps {
    role: Role;
}

export function RoleCard({ role }: RoleCardProps) {
    return (
        <Card className="mb-8 bg-purple-900/30 border-purple-500 text-center animate-fade-in">
            <CardHeader>
                <CardTitle className="text-2xl font-serif">Tu Rol: {role.name}</CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-gray-300">{role.description}</p>
            </CardContent>
        </Card>
    )
}
