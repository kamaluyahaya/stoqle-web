//src/app/page.tsx
import Gallery from "../components/feed/gallery";
import Posts from "../components/feed/post";
import Discover from "./discover/page";

export default function Page() {
  return (
    <div className="bg-white">
      <Discover />
    </div>
  );
}
