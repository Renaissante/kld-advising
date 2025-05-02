import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Trash2, Edit } from "lucide-react";

export function UserTable({ heading = "Users", data, role }) {

  const getColWidth = (role) => {
    if (role === "system_admin") return "w-1/5";
    if (role === "dean") return "w-1/6";
    if (role === "program_chair" || role === "faculty") return "w-1/7";
    if (role === "student") return "w-1/8";
    return "w-1/6";
  };

  const colWidth = getColWidth(role);

  return (
  <div className="space-y-3">
    <div className="flex items-center justify-start">
      <h2 className="text-lg md:text-xl font-semibold text-[#205c1c]">{heading}</h2>
    </div>
    <div className="overflow-x-auto">
      <Table className="min-w-full table-auto md:table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className={`${colWidth} whitespace-nowrap`}>KLD ID</TableHead>
            <TableHead className={`${colWidth} whitespace-nowrap`}>Name</TableHead>
            <TableHead className={`${colWidth} whitespace-nowrap`}>Email</TableHead>
            <TableHead className={`${colWidth} whitespace-nowrap`}>Role</TableHead>

            {role === "dean" && (
              <TableHead className={`${colWidth} whitespace-nowrap`}>Department</TableHead>
            )}
            {role === "program_chair" && (
              <>
                <TableHead className={`${colWidth} whitespace-nowrap`}>Department</TableHead>
                <TableHead className={`${colWidth} whitespace-nowrap`}>Program</TableHead>
              </>
            )}
            {role === "faculty" && (
              <>
                <TableHead className={`${colWidth} whitespace-nowrap`}>Department</TableHead>
                <TableHead className={`${colWidth} whitespace-nowrap`}>Specialization</TableHead>
              </>
            )}
            {role === "student" && (
              <>
                <TableHead className={`${colWidth} whitespace-nowrap`}>Department</TableHead>
                <TableHead className={`${colWidth} whitespace-nowrap`}>Section</TableHead>
                <TableHead className={`${colWidth} whitespace-nowrap`}>Advisor</TableHead>
              </>
            )}

            <TableHead className="text-right whitespace-nowrap">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((user) => (
            <TableRow key={user.id ? `${user.id}-${user.role}` : `${user.student_id}-${user.role}`}>
              <TableCell className="text-sm">{user.role === "student" ? user.student_id : user.employee_id}</TableCell>
              <TableCell className="text-sm">{user.name}</TableCell>
              <TableCell className="text-sm">{user.email}</TableCell>
              <TableCell className="text-sm">{user.role}</TableCell>

              {role === "dean" && <TableCell className="text-sm">{user.department}</TableCell>}
              {role === "program_chair" && (
                <>
                  <TableCell className="text-sm">{user.department}</TableCell>
                  <TableCell className="text-sm">{user.program}</TableCell>
                </>
              )}
              {role === "faculty" && (
                <>
                  <TableCell className="text-sm">{user.department}</TableCell>
                  <TableCell className="text-sm">{user.specialization}</TableCell>
                </>
              )}
              {role === "student" && (
                <>
                  <TableCell className="text-sm">{user.department}</TableCell>
                  <TableCell className="text-sm">{user.section}</TableCell>
                  <TableCell className="text-sm">{user.advisor}</TableCell>
                </>
              )}

              <TableCell className="text-right whitespace-nowrap">
                <div className="flex justify-end gap-2">
                <Button size="icon" variant="outline" className="p-2"><Edit size={24} /></Button>
                <Button size="icon" variant="destructive" className="p-2"><Trash2 size={24} /></Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  </div>
);
}