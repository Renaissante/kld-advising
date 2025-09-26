import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Trash2, Edit, Archive } from "lucide-react";

export function UserTable({ heading = "Users", data, role, onEdit, onArchive }) {

  // Define universal column width
  const colWidth = "w-1/8"; // Adjusted for more columns

  return (
  <div className="space-y-3">
    <div className="flex items-center justify-start">
      <h2 className="text-lg md:text-xl font-semibold text-[#205c1c]">{heading}</h2>
    </div>
    <div className="overflow-x-auto">
      <Table className="min-w-full table-auto md:table-fixed">
        <TableHeader>
          <TableRow><TableHead className={`w-[120px] whitespace-nowrap`}>KLD ID</TableHead><TableHead className={`${colWidth} whitespace-nowrap`}>Name</TableHead><TableHead className={`min-w-[150px]`}>Email</TableHead><TableHead className={`${colWidth} whitespace-nowrap`}>Role</TableHead><TableHead className={`${colWidth} whitespace-nowrap`}>Department</TableHead><TableHead className={`${colWidth} whitespace-nowrap`}>Program</TableHead><TableHead className={`${colWidth} whitespace-nowrap`}>Section</TableHead><TableHead className={`${colWidth} whitespace-nowrap`}>Advisor</TableHead><TableHead className="text-right whitespace-nowrap">Actions</TableHead></TableRow>
        </TableHeader>
        <TableBody>
          {data.map((user) => (
            <TableRow key={user.id}><TableCell className="text-sm">{user.KLD_ID}</TableCell><TableCell className="text-sm">{user.name}</TableCell><TableCell className="text-sm break-all">{user.email}</TableCell><TableCell className="text-sm">{user.role}</TableCell>{/* Conditional rendering for role-specific data */}<TableCell className="text-sm">{user.department || 'N/A'}</TableCell><TableCell className="text-sm">{user.program || 'N/A'}</TableCell><TableCell className="text-sm">{user.section || 'N/A'}</TableCell><TableCell className="text-sm">{user.advisor || 'N/A'}</TableCell><TableCell className="text-right "><div className="flex justify-end gap-2"><Button size="icon" variant="outline" className="p-2" onClick={() => onEdit(user)}><Edit size={24} /></Button><Button size="icon" variant="destructive" className="p-2" onClick={() => onArchive(user)}><Archive size={24} /></Button></div></TableCell></TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  </div>
);
}