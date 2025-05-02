import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { format, parse, isValid } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useState, useEffect } from "react";

export function DatePicker({ value, onChange, ...props }) {
  const [inputValue, setInputValue] = useState("");

  useEffect(() => {
    if (value) {
      try {
        const date = new Date(value);
        if (isValid(date)) {
          setInputValue(format(date, "MM/dd/yyyy"));
        } else {
          setInputValue("");
        }
      } catch (error) {
        console.error("Error formatting date:", error);
        setInputValue("");
      }
    } else {
      setInputValue("");
    }
  }, [value]);

  const handleInputChange = (e) => {
    let val = e.target.value.replace(/\D/g, ""); 

    if (val.length > 8) val = val.slice(0, 8); 

    if (val.length > 4) val = `${val.slice(0, 2)}/${val.slice(2, 4)}/${val.slice(4)}`;
    else if (val.length > 2) val = `${val.slice(0, 2)}/${val.slice(2)}`;

    setInputValue(val);
  };

  const handleBlur = () => {
    try {
      const parsedDate = parse(inputValue, "MM/dd/yyyy", new Date());
      if (isValid(parsedDate)) {
        const formattedDate = format(parsedDate, "MM/dd/yyyy");
        setInputValue(formattedDate);
        onChange(parsedDate.toISOString());
      } else {
        setInputValue("");
      }
    } catch (error) {
      console.error("Error parsing date:", error);
      setInputValue("");
    }
  };

  const handleDateSelect = (date) => {
    if (date) {
      try {
        const formattedDate = format(date, "MM/dd/yyyy");
        setInputValue(formattedDate);
        onChange(date.toISOString());
      } catch (error) {
        console.error("Error formatting selected date:", error);
        setInputValue("");
      }
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <div className="relative w-full">
          <Input
            {...props}
            value={inputValue}
            onChange={handleInputChange}
            onBlur={handleBlur}
            placeholder="MM/DD/YYYY"
          />
          <CalendarIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar
          mode="single"
          selected={inputValue ? parse(inputValue, "MM/dd/yyyy", new Date()) : undefined}
          onSelect={handleDateSelect}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
