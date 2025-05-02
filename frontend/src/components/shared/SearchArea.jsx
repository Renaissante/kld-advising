import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useState } from "react";

export function SearchArea({ value, onChange, ...props }) {
  return (
    <div className="relative w-1/10">
      <Input
        placeholder="Search..."
        value={value}
        onChange={onChange}
        className="pl-10" 
        {...props}
      />
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
    </div>
  );
}


export function SearchExample() {
  const [searchTerm, setSearchTerm] = useState("");
  return (
    <div className="p-4">
      <SearchComponent
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />
    </div>
  );
}
