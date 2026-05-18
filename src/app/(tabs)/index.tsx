import { globalStyles } from "@/styles/global";
import { useState } from "react";
import { Text, View } from "react-native";

import { type Book } from "@/models/book";

import BooksList from "@/components/BooksList";
import HomeHeader from "@/components/HomeHeader";
import SearchBar from "@/components/SearchBar";

export default function HomeScreen() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const header = (
    <View>
      <Text style={globalStyles.title}>Welcome to Word Bank!</Text>
      <HomeHeader />
      <SearchBar onResults={setBooks} onLoadingChange={setLoading} />
    </View>
  );

  return (
    <BooksList books={books} loading={loading} header={header} style={globalStyles.container} />
  );
}