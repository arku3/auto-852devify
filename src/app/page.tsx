import { FaceDetection, FileInputForm } from './client';

export default function Home() {
  return (
    <main className="container space-y-4 py-4">
      <FileInputForm />
      <FaceDetection />
    </main>
  );
}
