import ChatEmptyState from "@/components/chat/ChatEmptyState";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 h-full w-full items-center justify-center">
      <ChatEmptyState />
    </div>
  );
}

