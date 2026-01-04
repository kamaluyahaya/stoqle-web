const images = [
  "https://images.unsplash.com/photo-1503023345310-bd7c1de61c7d?w=1200&q=80",
  "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=1200&q=80",
  "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=1200&q=80",
  "https://images.unsplash.com/photo-1515378791036-0648a3ef77b2?w=1200&q=80",
];

export default function Post() {
  return (
    <section className="mb-10">
      <h2 className="mb-4 text-xl font-semibold">Gallery</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        {images.map(src => (
          <div key={src} className="overflow-hidden rounded-lg shadow-sm">
            <img
              src={src}
              className="h-48 w-full object-cover"
              loading="lazy"
            />
          </div>
        ))}
      </div>
    </section>
  );
}
