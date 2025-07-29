#!/usr/bin/env ruby

# New Weekly Issue Creator for AfterAI
# Usage: ruby add_new_issue.rb

require 'yaml'
require 'fileutils'

print "Enter the volume number: "
number = gets.chomp.to_i

print "Enter the slug (e.g., vol#{number}): "
slug = gets.chomp

puts "\nEnter the English transcription (end with a line containing only 'END'):"
transcription_en = []
while (line = gets.chomp) != 'END'
  transcription_en << line
end

puts "\nEnter the Japanese transcription (end with a line containing only 'END'):"
transcription_ja = []
while (line = gets.chomp) != 'END'
  transcription_ja << line
end

# Create new issue entry for YAML data
new_issue = {
  'number' => number,
  'slug' => slug,
  'transcription' => {
    'en' => "_includes/transcriptions/en/#{slug}.md",
    'ja' => "_includes/transcriptions/ja/#{slug}.md"
  }
}

# Load existing data
data_file = File.join(__dir__, '_data', 'weekly_issues.yml')
issues = YAML.load_file(data_file)

# Add new issue
issues << new_issue

# Sort by number
issues.sort_by! { |issue| issue['number'] }

# Write back to file
File.write(data_file, issues.to_yaml)

# Create transcription directories if they don't exist
FileUtils.mkdir_p(File.join(__dir__, '_includes', 'transcriptions', 'en'))
FileUtils.mkdir_p(File.join(__dir__, '_includes', 'transcriptions', 'ja'))

# Create English transcription file
en_transcription_path = File.join(__dir__, '_includes', 'transcriptions', 'en', "#{slug}.md")
File.write(en_transcription_path, transcription_en.join("\n\n"))

# Create Japanese transcription file
ja_transcription_path = File.join(__dir__, '_includes', 'transcriptions', 'ja', "#{slug}.md")
File.write(ja_transcription_path, transcription_ja.join("\n\n"))

# Create the HTML file
filename = "#{slug}.html"
filepath = File.join(__dir__, 'weekly', filename)

content = <<~CONTENT
  ---
  layout: weekly_issue
  title: "AfterAI Weekly Vol.#{number}"
  slug: #{slug}
  ---
CONTENT

File.write(filepath, content)

puts "\n✅ New issue added successfully!"
puts "Data file updated: #{data_file}"
puts "HTML file created: #{filepath}"
puts "English transcription created: #{en_transcription_path}"
puts "Japanese transcription created: #{ja_transcription_path}"
puts "\nDon't forget to add the corresponding images:"
puts "- img/weekly/en/#{slug}-en.jpg"
puts "- img/weekly/ja/#{slug}-ja.jpg"
