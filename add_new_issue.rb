#!/usr/bin/env ruby

# New Weekly Issue Creator for AfterAI
# Usage: ruby add_new_issue.rb

require 'yaml'
require 'fileutils'
require 'json'
require 'base64'
require 'net/http'
require 'uri'

print "Enter the volume number: "
number = gets.chomp.to_i

slug = "vol#{number}"
puts "Using slug: #{slug}"

def load_openai_api_key
  # Prefer environment variable, then fallback to .env file in repo root
  key = ENV['OPENAI_API_KEY']
  return key unless key.nil? || key.strip.empty?

  env_path = File.join(__dir__, '.env')
  if File.exist?(env_path)
    File.readlines(env_path, chomp: true).each do |line|
      next if line.strip.empty? || line.strip.start_with?('#')
      if (m = line.match(/\AOPENAI_API_KEY\s*=\s*['"]?(.+?)['"]?\s*\z/))
        return m[1]
      end
    end
  end
  nil
end

def find_weekly_image(slug, lang)
  # lang: 'en' or 'ja'
  base_dir = File.join(__dir__, 'img', 'weekly', lang)
  candidates = %W[
    #{slug}-#{lang}.jpg
    #{slug}-#{lang}.jpeg
    #{slug}-#{lang}.png
    #{slug}-#{lang}.webp
  ]
  candidates.each do |name|
    path = File.join(base_dir, name)
    return path if File.exist?(path)
  end
  nil
end

def mime_type_for(path)
  ext = File.extname(path).downcase
  case ext
  when '.jpg', '.jpeg' then 'image/jpeg'
  when '.png' then 'image/png'
  when '.webp' then 'image/webp'
  else 'application/octet-stream'
  end
end

def prompt_multiline(prompt)
  puts "\n#{prompt} (end with a line containing only 'END'):"
  lines = []
  while (line = STDIN.gets&.chomp)
    break if line == 'END'
    lines << line
  end
  lines.join("\n")
end

def generate_transcription_from_image(image_path, language_label, api_key)
  # language_label: 'English' or 'Japanese' – used in the prompt only
  return nil unless image_path && File.exist?(image_path)

  begin
    data = File.binread(image_path)
    b64 = Base64.strict_encode64(data)
    mime = mime_type_for(image_path)
    image_url = "data:#{mime};base64,#{b64}"

    uri = URI.parse('https://api.openai.com/v1/chat/completions')
    req = Net::HTTP::Post.new(uri)
    req['Content-Type'] = 'application/json'
    req['Authorization'] = "Bearer #{api_key}"

    system_prompt = "You are a meticulous OCR assistant."
    user_text = [
      "Transcribe all legible text exactly as it appears in this image.",
      "Keep the original language (#{language_label}).",
      "Preserve line breaks where natural. Do not translate or add commentary.",
    ].join(' ')

    payload = {
      model: 'gpt-5-mini',
      messages: [
        { role: 'system', content: system_prompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: user_text },
            { type: 'image_url', image_url: { url: image_url } }
          ]
        }
      ]
    }

    req.body = JSON.dump(payload)

    res = Net::HTTP.start(uri.host, uri.port, use_ssl: true) do |http|
      http.request(req)
    end

    unless res.is_a?(Net::HTTPSuccess)
      warn "OpenAI API error (#{res.code}): #{res.body}"
      return nil
    end

    body = JSON.parse(res.body)
    content = body.dig('choices', 0, 'message', 'content')
    content&.strip
  rescue => e
    warn "Failed to generate transcription: #{e.class}: #{e.message}"
    nil
  end
end

api_key = load_openai_api_key

# Try auto-generation from images; fallback to manual input if unavailable
en_image = find_weekly_image(slug, 'en')
ja_image = find_weekly_image(slug, 'ja')

transcription_en = nil
transcription_ja = nil

if api_key && en_image
  puts "\nGenerating English transcription from #{en_image} using OpenAI…"
  transcription_en = generate_transcription_from_image(en_image, 'English', api_key)
end
if api_key && ja_image
  puts "\nGenerating Japanese transcription from #{ja_image} using OpenAI…"
  transcription_ja = generate_transcription_from_image(ja_image, 'Japanese', api_key)
end

transcription_en ||= prompt_multiline("Enter the English transcription")
transcription_ja ||= prompt_multiline("Enter the Japanese transcription")

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
File.write(en_transcription_path, transcription_en)

# Create Japanese transcription file
ja_transcription_path = File.join(__dir__, '_includes', 'transcriptions', 'ja', "#{slug}.md")
File.write(ja_transcription_path, transcription_ja)

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
