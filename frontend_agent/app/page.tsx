import { ChatWindow } from "@/components/chat/ChatWindow";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 h-full w-full items-center justify-center p-4">
      <ChatWindow />
    </div>
  );
}
